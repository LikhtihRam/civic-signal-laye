"""Seed data generator for CivicSentinel — realistic Indian civic complaints."""
import csv
import random
import uuid
import math
from datetime import datetime, timedelta
from pathlib import Path

# Ward definitions with approximate Bangalore coordinates
WARDS = {
    "Koramangala 4th Block": {"lat": 12.9352, "long": 77.6245, "pop": 45000},
    "Koramangala 1st Block": {"lat": 12.9380, "long": 77.6200, "pop": 38000},
    "Indiranagar": {"lat": 12.9784, "long": 77.6408, "pop": 52000},
    "Whitefield Main Road": {"lat": 12.9698, "long": 77.7500, "pop": 61000},
    "Jayanagar 4th T Block": {"lat": 12.9220, "long": 77.5850, "pop": 42000},
}

# Main cluster: Water infrastructure issues in Koramangala 4th Block
# ~27 complaints deliberately clustered
CLUSTER_WATER = {
    "ward": "Koramangala 4th Block",
    "center_lat": 12.9355,
    "center_long": 77.6248,
    "radius": 0.003,
    "count": 27,
    "category": "water_leakage",
    "days_span": 22,
}

# Secondary cluster: Drainage in Indiranagar
CLUSTER_DRAINAGE = {
    "ward": "Indiranagar",
    "center_lat": 12.9780,
    "center_long": 77.6410,
    "radius": 0.004,
    "count": 19,
    "category": "blocked_drain",
    "days_span": 18,
}

# Tertiary cluster: Road damage in Whitefield
CLUSTER_ROADS = {
    "ward": "Whitefield Main Road",
    "center_lat": 12.9700,
    "center_long": 77.7505,
    "radius": 0.003,
    "count": 15,
    "category": "pothole",
    "days_span": 15,
}

# Water complaint templates for the main cluster
WATER_COMPLAINTS = [
    "Water leaking from the main pipeline near {location} for the past {days} days. The road is completely flooded and vehicles cannot pass.",
    "No water supply in our area since morning. When water comes, it's just a trickle. Pipes seem to be burst somewhere underground.",
    "Low water pressure in {location} area. We have complained multiple times but no action taken. The water barely reaches the 2nd floor.",
    "Street is completely flooded with water from a burst pipe near {location}. Children are walking through knee-deep water to school.",
    "Water leakage has damaged the road surface near {location}. Large cracks have appeared and the asphalt is crumbling.",
    "Borewell water is muddy and undrinkable for the past week. Suspect contamination from nearby pipe burst.",
    "Major water pipe burst near {location}. Water is gushing out and creating a small river on the street. Very wasteful of treated water.",
    "Our apartment complex has had low water pressure for 3 weeks. The municipal supply barely trickles. We suspect a leak in the main line.",
    "Water logging on {location} road due to broken water main. The stagnant water is becoming a breeding ground for mosquitoes.",
    "Pipeline leakage has caused the road near {location} to collapse. Very dangerous for two-wheelers. Multiple people have fallen.",
    "The underground water pipe on our street burst at night. By morning, the entire street was submerged. Please repair urgently.",
    "Water supply is irregular and low pressure in the mornings. We suspect the main distribution pipe has a leak affecting the whole block.",
    "Leaking fire hydrant near {location} has been wasting thousands of liters daily. Nobody has come to fix it despite multiple complaints.",
    "Road cave-in near {location} due to water pipe leakage underneath. Very dangerous — a child could fall into the hole.",
    "The water pipeline from the overhead tank to our ward has multiple leak points. Water doesn't reach our area properly.",
    "Constant water seepage on {location} road. The entire stretch is wet and slippery. Already caused 3 accidents this month.",
    "Water main burst at the junction near {location}. Traffic is completely blocked. Water is being wasted into storm drains.",
    "Blue water stains on the road near {location} indicate underground pipe leaks. The road has sunk about 6 inches in spots.",
    "Our street has had intermittent water supply for 2 weeks. When it comes, it's brown and contaminated. Major pipe damage suspected.",
    "The water supply pipeline to {location} area is clearly damaged. We can see water bubbling up through the road surface.",
    "Multiple houses in our colony report low water pressure. The old cast iron pipes along the main road seem to be corroded and leaking.",
    "Water pipeline burst near the school in {location}. Students are getting wet walking to school. Authorities must act urgently.",
    "The corporation water supply pipeline runs right through our street and it's leaking at multiple points. Road is damaged.",
    "We've reported low water pressure 5 times this month. Nobody inspects the underground pipeline that serves our ward.",
    "A major water line broke last night near {location}. Water was flowing for 6 hours before anyone noticed. Huge waste.",
    "Water is seeping through the road near {location} park. The park fence has tilted due to the water damage to the foundation.",
    "The main water distribution line for {location} ward has a slow leak that's been getting worse over the past month. Road damage visible.",
]

# Scattered complaint templates for other categories
SCATTERED_COMPLAINTS = {
    "water_leakage": [
        "Minor water leak from the junction box on our street. Water dripping continuously for days.",
    ],
    "low_pressure": [
        "Water pressure is very low during peak hours. Difficult to even fill a bucket.",
        "Third floor flats get almost no water. The pressure is inadequate for upper floors.",
    ],
    "road_flooding": [
        "Heavy rain caused flooding on {location} road. Cars stalled in water.",
        "Road积水 after rain — the drainage cannot handle the flow. Water stays for hours.",
    ],
    "drainage": [
        "Storm drain on {location} is completely blocked. Water accumulates on the road after any rain.",
        "Open drains in our colony smell terrible and are overflowing. Health hazard for children.",
        "The drainage canal near {location} has not been cleaned in months. Overflowing with garbage and stagnant water.",
        "Sewage is backing up into residential areas near {location}. The drain capacity seems insufficient.",
    ],
    "blocked_drain": [
        "The drain on {location} road is blocked with plastic waste. After every rain, the road floods.",
        "Main storm drain is clogged and overflowing near the market area. Stinking water entering shops.",
        "Drain near {location} is full of construction debris. Water cannot flow and the entire lane floods.",
        "The sewage drain in our area overflows every evening. Very unhygienic. Complaints to the ward office ignored.",
        "Large drain near {location} junction is completely blocked. Mosquitoes everywhere. Dengue risk is high.",
        "Overflowing drain outside {location} school. Children have to walk past the stinking water every day.",
        "The underground drain pipe has collapsed near {location}. Road has sunk and water is stagnant.",
        "Drainage water from {location} is mixing with the drinking water pipeline area. Contamination risk.",
        "Multiple drains in the Indiranagar 100 Feet Road area are blocked. The entire stretch smells of sewage.",
        "The drain near {location} park is filled to the brim. Any more rain and it will enter nearby homes.",
    ],
    "waterlogging": [
        "The low-lying area near {location} always gets waterlogged during monsoon. Needs a permanent solution.",
    ],
    "sewage": [
        "Sewage pipe has burst near {location}. Raw sewage is flowing on the road. Extreme health hazard.",
        "Our area's sewage system cannot handle the load during peak hours. Backflow into homes is common.",
    ],
    "pothole": [
        "Massive pothole near {location} bus stop. Multiple bikes have fallen. Very dangerous especially at night.",
        "The road from {location} to the main junction is full of potholes. Worst condition I've seen in 20 years.",
        "Potholes on {location} road have become so deep that cars bottom out. Buses are unable to use this route.",
        "Three-wheeler skidded into a pothole near {location}. Passenger was injured. Road is completely broken.",
        "The flyover ramp near {location} has developed dangerous potholes. Vehicles swerve suddenly to avoid them.",
        "Road surface near {location} market is completely broken. Every monsoon it gets worse. Nothing is ever repaired.",
        "Road near {location} school is full of potholes. School buses have to drive very slowly. Takes twice as long.",
        "Pothole on {location} main road caused a motorcyclist to crash. Hospital treatment needed. Please fix urgently.",
        "The stretch near {location} has at least 15 potholes in 500 meters. It's like an obstacle course.",
    ],
    "road_damage": [
        "The road near {location} is cracking and breaking apart. Likely due to heavy vehicle traffic.",
        "Road construction was done poorly near {location}. The surface started breaking within 6 months.",
    ],
    "road_crack": [
        "Large cracks developing on {location} road. The foundation seems to be shifting.",
    ],
    "power_outage": [
        "Frequent power cuts in our area. Sometimes 4-5 hours without electricity. Very difficult for work from home.",
        "The transformer near {location} keeps tripping. Power goes out at least 3 times a week.",
    ],
    "streetlight": [
        "Streetlights on {location} road are not working for the past week. The road is pitch dark at night. Safety concern.",
        "Half the streetlights on {location} main road are broken. Women feel unsafe walking in the evening.",
    ],
    "electrical_hazard": [
        "Live electrical wire hanging low near {location}. Very dangerous for pedestrians and vehicles.",
        "The electric pole near {location} is tilted and the wires are touching the ground. Electrocution risk.",
    ],
    "transformer": [
        "Transformer near {location} is making loud buzzing sounds and sparks. Could explode anytime.",
    ],
    "power_fluctuation": [
        "Voltage fluctuations have damaged 3 appliances in our house this month. The power supply is very unstable.",
    ],
    "garbage": [
        "Garbage has not been collected for 5 days in {location} area. The bins are overflowing and it smells terrible.",
        "The municipal garbage collection van comes only twice a week. Waste piles up on the road causing health issues.",
    ],
    "waste": [
        "Construction waste dumped on {location} road. Pedestrians cannot walk on the footpath.",
        "Medical waste found near {location} park. Very dangerous for children playing in the area.",
    ],
    "overflowing_bin": [
        "Community dustbin near {location} market is overflowing. Stinking garbage spread all over the area.",
        "The garbage bin at {location} junction has not been emptied in a week. Strays are scattering waste everywhere.",
    ],
    "open_defecation": [
        "Open defecation near {location} is a daily problem. Despite having toilets, people use the open area. Very unhygienic.",
    ],
    "dead_animal": [
        "Dead dog on {location} road for 3 days. Nobody has come to remove it. It's decomposing and attracting flies.",
    ],
    "foul_smell": [
        "Foul smell from the {location} area due to accumulated waste. Residents cannot keep windows open.",
    ],
    "contaminated_water": [
        "Water from our tap is discolored and smells like chlorine. People in the area are falling sick.",
    ],
    "disease_outbreak": [
        "Multiple cases of waterborne illness reported in {location} ward. 12 people admitted to hospital last week.",
    ],
    "mosquito": [
        "Mosquito menace in {location} area has become severe. The stagnant water from the blocked drain is the cause.",
    ],
    "foul_smell": [
        "Terrible stench from the {location} area due to untreated sewage mixing with rainwater runoff.",
    ],
}

LOCATIONS = [
    "4th Block Main Road", "1st Main Road", "12th Cross", "80 Feet Road",
    "5th Block Park", "Near Forum Mall", "Near Jyoti Nivas College",
    "NEED Cross Road", "AK Colony", "BTM Layout Junction",
    "100 Feet Road", "HAL 2nd Stage", "Old Airport Road",
    "Marathahalli Bridge", "ITPL Main Road", "Near Phoenix Mall",
    "4th T Block Main", "30th Cross", "27th Main",
    "Near Jayanagar Shopping Complex", "NS Palya Road",
    "Anepalya Junction", "Near Lalbagh West Gate",
]

SEVERITY_DISTRIBUTION = ["Low"] * 20 + ["Medium"] * 40 + ["High"] * 30 + ["Critical"] * 10
SENTIMENT_OPTIONS = ["frustrated", "concerned", "angry", "worried", "neutral", "urgent"]

random.seed(42)  # Reproducible


def generate_complaint_text(category, location=None):
    """Generate a realistic complaint text for a given category."""
    templates = SCATTERED_COMPLAINTS.get(category, [])
    if category == "water_leakage":
        templates = WATER_COMPLAINTS + templates
    if not templates:
        templates = [f"Report: {category.replace('_', ' ')} issue reported near {{location}}. Please investigate."]
    
    template = random.choice(templates)
    if location is None:
        location = random.choice(LOCATIONS)
    return template.format(location=location, days=random.randint(5, 30))


def generate_cluster_complaints(cluster_config):
    """Generate complaints for a specific cluster scenario."""
    complaints = []
    start_date = datetime(2026, 8, 1) + timedelta(days=random.randint(0, 5))
    
    locations = [random.choice(LOCATIONS) for _ in range(5)]
    
    for i in range(cluster_config["count"]):
        lat = cluster_config["center_lat"] + random.gauss(0, cluster_config["radius"] / 3)
        lng = cluster_config["center_long"] + random.gauss(0, cluster_config["radius"] / 3)
        days_offset = random.randint(0, cluster_config["days_span"])
        timestamp = start_date + timedelta(days=days_offset, hours=random.randint(6, 22), minutes=random.randint(0, 59))
        
        location = random.choice(locations)
        category = cluster_config["category"]
        
        # For water cluster, vary the category slightly
        if cluster_config.get("category") == "water_leakage":
            category = random.choice(["water_leakage", "low_pressure", "road_flooding", "water_leakage", "water_leakage"])
        
        text = generate_complaint_text(category, location)
        severity = random.choice(SEVERITY_DISTRIBUTION)
        urgency = random.choice([True, False])
        
        complaints.append({
            "id": f"CMP-{str(uuid.uuid4())[:8].upper()}",
            "raw_text": text,
            "source_platform": "synthetic",
            "timestamp": timestamp.isoformat(),
            "lat": round(lat, 6),
            "long": round(lng, 6),
            "ward": cluster_config["ward"],
            "category_raw": category,
            "image_url": None,
            "citizen_id_masked": f"CIT-{random.randint(1000, 9999)}",
        })
    
    return complaints


def generate_scattered_complaints(wards, total_count):
    """Generate scattered complaints across wards that don't form clusters."""
    complaints = []
    all_categories = list(SCATTERED_COMPLAINTS.keys())
    start_date = datetime(2026, 8, 1)
    ward_list = list(wards.keys())
    
    for i in range(total_count):
        ward = random.choice(ward_list)
        ward_info = wards[ward]
        category = random.choice(all_categories)
        
        lat = ward_info["lat"] + random.gauss(0, 0.008)
        lng = ward_info["long"] + random.gauss(0, 0.008)
        
        days_offset = random.randint(0, 29)
        timestamp = start_date + timedelta(days=days_offset, hours=random.randint(6, 22), minutes=random.randint(0, 59))
        
        location = random.choice(LOCATIONS)
        text = generate_complaint_text(category, location)
        
        complaints.append({
            "id": f"CMP-{str(uuid.uuid4())[:8].upper()}",
            "raw_text": text,
            "source_platform": "synthetic",
            "timestamp": timestamp.isoformat(),
            "lat": round(lat, 6),
            "long": round(lng, 6),
            "ward": ward,
            "category_raw": category,
            "image_url": None,
            "citizen_id_masked": f"CIT-{random.randint(1000, 9999)}",
        })
    
    return complaints


def generate_seed_data():
    """Generate the complete synthetic dataset."""
    all_complaints = []
    
    # Cluster 1: Water infrastructure in Koramangala 4th Block (27 complaints)
    print("Generating water infrastructure cluster (27 complaints)...")
    all_complaints.extend(generate_cluster_complaints(CLUSTER_WATER))
    
    # Cluster 2: Drainage in Indiranagar (19 complaints)
    print("Generating drainage cluster (19 complaints)...")
    all_complaints.extend(generate_cluster_complaints(CLUSTER_DRAINAGE))
    
    # Cluster 3: Roads in Whitefield (15 complaints)
    print("Generating road damage cluster (15 complaints)...")
    all_complaints.extend(generate_cluster_complaints(CLUSTER_ROADS))
    
    # Scattered complaints (~200 across all wards)
    scattered_count = 250 - 27 - 19 - 15  # ~189 scattered
    print(f"Generating {scattered_count} scattered complaints across wards...")
    all_complaints.extend(generate_scattered_complaints(WARDS, scattered_count))
    
    # Shuffle for realism
    random.shuffle(all_complaints)
    
    # Write to CSV
    output_path = Path(__file__).parent / "seed_data.csv"
    fieldnames = ["id", "raw_text", "source_platform", "timestamp", "lat", "long", 
                  "ward", "category_raw", "image_url", "citizen_id_masked"]
    
    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(all_complaints)
    
    print(f"\nGenerated {len(all_complaints)} complaints → {output_path}")
    print(f"  Cluster 1 (Water): {CLUSTER_WATER['count']} complaints in {CLUSTER_WATER['ward']}")
    print(f"  Cluster 2 (Drainage): {CLUSTER_DRAINAGE['count']} complaints in {CLUSTER_DRAINAGE['ward']}")
    print(f"  Cluster 3 (Roads): {CLUSTER_ROADS['count']} complaints in {CLUSTER_ROADS['ward']}")
    print(f"  Scattered: {scattered_count} complaints across {len(WARDS)} wards")
    return output_path


if __name__ == "__main__":
    generate_seed_data()
