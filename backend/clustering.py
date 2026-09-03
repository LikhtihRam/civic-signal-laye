"""Correlation Engine — DBSCAN-based geo-temporal-categorical clustering."""
import math
import uuid
from datetime import datetime, timedelta
from typing import List, Dict, Tuple, Optional
import numpy as np
from database import get_db, parse_json_field
from config import (
    GEO_CLUSTER_RADIUS_M, TEMPORAL_WINDOW_DAYS, 
    CATEGORY_TO_FAMILY, CATEGORY_FAMILIES, DBSCAN_MIN_SAMPLES
)


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two lat/long points in meters."""
    R = 6371000  # Earth's radius in meters
    
    lat1_r = math.radians(lat1)
    lat2_r = math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1_r) * math.cos(lat2_r) * math.sin(dlon / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c


def get_category_family(category: str) -> str:
    """Map a specific category to its family/group."""
    if category in CATEGORY_TO_FAMILY:
        return CATEGORY_TO_FAMILY[category]
    # Fuzzy match
    for family, cats in CATEGORY_FAMILIES.items():
        for cat in cats:
            if cat in category or category in cat:
                return family
    return "other"


def are_categories_related(cat1: str, cat2: str) -> bool:
    """Check if two categories belong to the same family."""
    family1 = get_category_family(cat1)
    family2 = get_category_family(cat2)
    return family1 == family2 and family1 != "other"


def build_feature_matrix(complaints: List[dict]) -> Tuple[np.ndarray, List[str]]:
    """Build a feature matrix for DBSCAN clustering.
    
    Features: lat, long, day_offset, category_family_encoded
    """
    if not complaints:
        return np.array([]), []
    
    # Get time reference
    timestamps = [datetime.fromisoformat(c["timestamp"]) for c in complaints]
    min_time = min(timestamps)
    
    # Category families for encoding
    all_families = list(CATEGORY_FAMILIES.keys()) + ["other"]
    family_to_idx = {f: i for i, f in enumerate(all_families)}
    
    features = []
    ids = []
    
    for c in complaints:
        ts = datetime.fromisoformat(c["timestamp"])
        day_offset = (ts - min_time).total_seconds() / 86400  # Days since earliest
        family = get_category_family(c.get("category", ""))
        family_idx = family_to_idx.get(family, len(all_families) - 1)
        
        # Normalize lat/long to meters from center
        center_lat = np.mean([cc["lat"] for cc in complaints if cc.get("lat")])
        center_long = np.mean([cc["long"] for cc in complaints if cc.get("long")])
        
        lat_m = (c["lat"] - center_lat) * 111320  # meters
        long_m = (c["long"] - center_long) * 111320 * math.cos(math.radians(center_lat))
        
        features.append([lat_m, long_m, day_offset, family_idx])
        ids.append(c["id"])
    
    return np.array(features), ids


def cluster_complaints(
    geo_radius_m: float = None,
    temporal_window_days: int = None,
    min_samples: int = None
) -> List[dict]:
    """Run DBSCAN clustering on all structured complaints.
    
    Returns a list of cluster objects with member complaint IDs.
    """
    from sklearn.cluster import DBSCAN
    from sklearn.preprocessing import StandardScaler
    
    radius = geo_radius_m or GEO_CLUSTER_RADIUS_M
    window = temporal_window_days or TEMPORAL_WINDOW_DAYS
    min_s = min_samples or DBSCAN_MIN_SAMPLES
    
    with get_db() as conn:
        # Get all structured complaints with coordinates
        rows = conn.execute("""
            SELECT c.id, c.raw_text, c.timestamp, c.lat, c.long, c.ward, c.category_raw,
                   sc.category, sc.severity, sc.urgency_flag
            FROM complaints c
            JOIN structured_complaints sc ON c.id = sc.complaint_id
            WHERE c.lat IS NOT NULL AND c.long IS NOT NULL
            ORDER BY c.timestamp
        """).fetchall()
        
        if not rows:
            print("No structured complaints found. Run extraction first.")
            return []
        
        complaints = [dict(r) for r in rows]
        print(f"Clustering {len(complaints)} complaints...")
        
        # Filter by temporal window
        if window:
            cutoff = datetime.now() - timedelta(days=window)
            complaints = [c for c in complaints if datetime.fromisoformat(c["timestamp"]) >= cutoff]
            print(f"  After temporal filter ({window} days): {len(complaints)} complaints")
        
        if len(complaints) < min_s:
            print("  Not enough complaints for clustering.")
            return []
        
        # Build feature matrix
        features, ids = build_feature_matrix(complaints)
        
        if len(features) == 0:
            return []
        
        # Scale features (weight geo more heavily than time)
        scaler = StandardScaler()
        features_scaled = scaler.fit_transform(features)
        
        # Increase geo weight
        features_scaled[:, 0] *= 2.0  # lat weight
        features_scaled[:, 1] *= 2.0  # long weight
        
        # DBSCAN with distance in scaled space
        # Use radius_m / expected_scale as eps
        eps = radius / 500  # Scale radius to work with normalized features
        db = DBSCAN(eps=eps, min_samples=min_s, metric='euclidean')
        labels = db.fit_predict(features_scaled)
        
        # Build clusters from labels
        unique_labels = set(labels)
        unique_labels.discard(-1)  # Remove noise label
        
        clusters = []
        
        # Also handle -1 (noise) — group by ward + category if enough complaints
        noise_ids = [ids[i] for i in range(len(ids)) if labels[i] == -1]
        noise_complaints = [complaints[i] for i in range(len(complaints)) if labels[i] == -1]
        
        # Group noise by ward + category family
        noise_groups = {}
        for cid, comp in zip(noise_ids, noise_complaints):
            key = (comp["ward"], get_category_family(comp.get("category", "")))
            if key not in noise_groups:
                noise_groups[key] = []
            noise_groups[key].append((cid, comp))
        
        for (ward, family), members in noise_groups.items():
            if len(members) >= min_s:
                member_ids = [m[0] for m in members]
                member_complaints = [m[1] for m in members]
                centroid_lat = np.mean([m[1]["lat"] for m in members])
                centroid_long = np.mean([m[1]["long"] for m in members])
                timestamps = [datetime.fromisoformat(m[1]["timestamp"]) for m in members]
                
                clusters.append({
                    "id": f"CL-{str(uuid.uuid4())[:8].upper()}",
                    "member_complaint_ids": member_ids,
                    "centroid_lat": round(float(centroid_lat), 6),
                    "centroid_long": round(float(centroid_long), 6),
                    "ward": ward,
                    "category_family": family,
                    "time_window_start": min(timestamps).isoformat(),
                    "time_window_end": max(timestamps).isoformat(),
                    "member_count": len(member_ids),
                    "complaints": member_complaints,
                })
        
        # Process DBSCAN clusters
        for label in unique_labels:
            member_indices = [i for i in range(len(labels)) if labels[i] == label]
            member_ids = [ids[i] for i in member_indices]
            member_complaints = [complaints[i] for i in member_indices]
            
            centroid_lat = np.mean([complaints[i]["lat"] for i in member_indices])
            centroid_long = np.mean([complaints[i]["long"] for i in member_indices])
            
            # Determine dominant ward and category family
            wards = [complaints[i]["ward"] for i in member_indices]
            categories = [complaints[i].get("category", "") for i in member_indices]
            families = [get_category_family(c) for c in categories]
            
            from collections import Counter
            dominant_ward = Counter(wards).most_common(1)[0][0]
            dominant_family = Counter(families).most_common(1)[0][0]
            
            timestamps = [datetime.fromisoformat(complaints[i]["timestamp"]) for i in member_indices]
            
            clusters.append({
                "id": f"CL-{str(uuid.uuid4())[:8].upper()}",
                "member_complaint_ids": member_ids,
                "centroid_lat": round(float(centroid_lat), 6),
                "centroid_long": round(float(centroid_long), 6),
                "ward": dominant_ward,
                "category_family": dominant_family,
                "time_window_start": min(timestamps).isoformat(),
                "time_window_end": max(timestamps).isoformat(),
                "member_count": len(member_ids),
                "complaints": member_complaints,
            })
        
        # Sort by member count descending
        clusters.sort(key=lambda x: x["member_count"], reverse=True)
        
        # Persist clusters to DB
        conn.execute("DELETE FROM clusters")  # Clear existing clusters
        for cluster in clusters:
            conn.execute("""
                INSERT INTO clusters 
                (id, member_complaint_ids, centroid_lat, centroid_long, ward, 
                 category_family, time_window_start, time_window_end, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
            """, (
                cluster["id"],
                json.dumps(cluster["member_complaint_ids"]),
                cluster["centroid_lat"],
                cluster["centroid_long"],
                cluster["ward"],
                cluster["category_family"],
                cluster["time_window_start"],
                cluster["time_window_end"],
            ))
        
        print(f"\nCreated {len(clusters)} clusters:")
        for i, c in enumerate(clusters[:10]):
            print(f"  {i+1}. {c['ward']} / {c['category_family']}: {c['member_count']} complaints")
        
        return clusters


import json

if __name__ == "__main__":
    clusters = cluster_complaints()
    print(f"\nTotal clusters found: {len(clusters)}")
