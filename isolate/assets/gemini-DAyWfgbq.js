const d="https://generativelanguage.googleapis.com/v1beta";function c(){return localStorage.getItem("civicsentinel_gemini_key")}function f(r){localStorage.setItem("civicsentinel_gemini_key",r)}function w(){return c()}function h(){localStorage.removeItem("civicsentinel_gemini_key")}async function l(r,e){const a=c();if(!a)throw new Error("Gemini API key not configured. Go to Settings to add it.");const t=`${d}/models/gemini-2.0-flash:generateContent?key=${a}`,i={contents:[{parts:[{text:`${r}

${e}`}]}],generationConfig:{temperature:.3,maxOutputTokens:2048}},n=await fetch(t,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(i)});if(!n.ok){const m=await n.json().catch(()=>({}));throw new Error(m?.error?.message||`Gemini API error ${n.status}`)}return(await n.json()).candidates?.[0]?.content?.parts?.[0]?.text||""}function g(r){let e=r.trim();e=e.replace(/^```(?:json)?\s*\n?/,"").replace(/\n?```\s*$/,"");const a=e.match(/\{[\s\S]*\}/);a&&(e=a[0]);try{return JSON.parse(e)}catch{return e=e.replace(/'/g,'"').replace(/,\s*}/g,"}").replace(/,\s*]/g,"]"),JSON.parse(e)}}const u=`You are a civic complaint analysis AI. Extract structured information from citizen complaint texts.

Return ONLY valid JSON — no markdown, no preamble:
{
  "category": "one of: water_leakage, low_pressure, road_flooding, drainage, blocked_drain, waterlogging, sewage, pothole, road_damage, road_crack, power_outage, streetlight, electrical_hazard, transformer, power_fluctuation, garbage, waste, overflowing_bin, open_defecation, dead_animal, foul_smell, contaminated_water, disease_outbreak, mosquito",
  "severity": "Low|Medium|High|Critical",
  "urgency_flag": true/false,
  "affected_population_estimate": <number>,
  "sentiment": "neutral|concerned|frustrated|angry|urgent",
  "estimated_days": <number of days to resolve, realistic for Indian municipal governance>,
  "summary": "one-line summary of the complaint"
}

Severity: Critical=danger to life, High=widespread/health risk, Medium=ongoing daily issue, Low=minor.
Estimated days: Critical=1-3, High=3-7, Medium=7-14, Low=14-30. Adjust for scope.`,o={water_leakage:{category:"water_leakage",severity:"High",urgency_flag:!0,affected_population_estimate:500,sentiment:"frustrated",estimated_days:5,summary:"Water leakage reported"},low_pressure:{category:"low_pressure",severity:"Medium",urgency_flag:!1,affected_population_estimate:300,sentiment:"concerned",estimated_days:10,summary:"Low water pressure issue"},pothole:{category:"pothole",severity:"High",urgency_flag:!0,affected_population_estimate:200,sentiment:"angry",estimated_days:7,summary:"Road pothole hazard"},drainage:{category:"drainage",severity:"Medium",urgency_flag:!1,affected_population_estimate:400,sentiment:"concerned",estimated_days:12,summary:"Drainage issue reported"},power_outage:{category:"power_outage",severity:"High",urgency_flag:!0,affected_population_estimate:1e3,sentiment:"frustrated",estimated_days:3,summary:"Power outage reported"}};async function S(r,e){try{const a=await l(u,`Complaint text: "${r}"
Ward: ${e}
Timestamp: ${new Date().toISOString()}`),t=g(a);return{category:String(t.category||"other"),severity:["Low","Medium","High","Critical"].includes(String(t.severity))?String(t.severity):"Medium",urgency_flag:!!t.urgency_flag,affected_population_estimate:Number(t.affected_population_estimate)||200,sentiment:String(t.sentiment||"neutral"),estimated_days:Math.max(1,Math.min(30,Number(t.estimated_days)||7)),summary:String(t.summary||r.substring(0,100))}}catch{const a=r.toLowerCase(),t=Object.keys(o).find(n=>a.includes(n.replace(/_/g," "))),i=t?o[t]:{category:"other",severity:"Medium",urgency_flag:!1,affected_population_estimate:200,sentiment:"neutral",estimated_days:10,summary:r.substring(0,100)};return/\b(danger|collapse|explode|injur|hospital|electroc)\b/i.test(a)?{...i,severity:"Critical",urgency_flag:!0,estimated_days:2}:/\b(major|widespread|health|week|month|overflow)\b/i.test(a)?{...i,severity:"High",urgency_flag:i.urgency_flag,estimated_days:Math.min(i.estimated_days,7)}:i}}const p=`You are a municipal infrastructure analyst. Given a citizen complaint, generate:
1. A probable root cause (1-2 sentences)
2. An estimated resolution time in days (realistic for Indian municipal governance)
3. The responsible department
4. A brief explanation of why the ETA is what it is

Return ONLY valid JSON:
{
  "root_cause": "probable root cause explanation",
  "estimated_days": <number>,
  "department": "responsible department name",
  "eta_reasoning": "brief explanation of the timeline estimate"
}`,s={water_leakage:"Water Supply & Sewerage Board",low_pressure:"Water Supply & Sewerage Board",road_flooding:"Storm Water & Drainage",drainage:"Storm Water & Drainage",blocked_drain:"Storm Water & Drainage",waterlogging:"Storm Water & Drainage",sewage:"Sewerage Board",pothole:"Roads & Infrastructure",road_damage:"Roads & Infrastructure",power_outage:"Electricity Supply Company (ESCOM)",streetlight:"Electricity Supply Company (ESCOM)",electrical_hazard:"Electricity Supply Company (ESCOM)",garbage:"Solid Waste Management",waste:"Solid Waste Management",overflowing_bin:"Solid Waste Management"},_={water_leakage:5,low_pressure:10,road_flooding:4,drainage:8,blocked_drain:6,waterlogging:5,sewage:3,pothole:7,road_damage:10,power_outage:3,streetlight:10,electrical_hazard:2,garbage:5,waste:4,overflowing_bin:4};async function b(r,e,a){try{const t=await l(p,`Complaint: "${r}"
Category: ${e}
Severity: ${a}`),i=g(t);return{root_cause:String(i.root_cause||"Under investigation"),estimated_days:Math.max(1,Math.min(30,Number(i.estimated_days)||7)),department:String(i.department||s[e]||"Municipal Services"),eta_reasoning:String(i.eta_reasoning||"Estimated based on similar resolved complaints")}}catch{return{root_cause:`Likely ${e.replace(/_/g," ")} issue requiring inspection and repair`,estimated_days:_[e]||10,department:s[e]||"Municipal Services",eta_reasoning:"Estimated based on typical resolution timelines for this category"}}}export{b as a,h as c,S as e,w as g,f as s};
