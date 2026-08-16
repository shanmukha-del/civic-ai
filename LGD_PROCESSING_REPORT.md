# 🏛️ LGD ALL-INDIA LOCATION DATASET PROCESSING REPORT

**Processing Status**: 🟢 SUCCESS (100% Verified Match)  
**Processing Duration**: 43.88 seconds  
**Generation Timestamp**: 8/16/2026, 11:38:38 AM  
**Source Excel File**: `list-of-states-districts-sub-districts-and-villages-along-with-their-lgd-codes-as-of-2-july-2026.xlsx`  

---

## 📊 Summary Metrics

| Metric | Count |
| :--- | :--- |
| **Total Source Rows Read** | **676,891** |
| **Valid Processed Records** | **676,891** |
| **Invalid / Empty Rows** | **0** |
| **Exact Duplicate Keys** | **0** |
| **Total States / UTs** | **35** |
| **Total Districts** | **781** |
| **Total Sub-Districts / Mandals** | **7,073** |
| **Total Villages / Localities** | **676,891** |

---

## 🗺️ State & Union Territory Breakdown

| State Code | State / UT Name | Districts | Mandals | Villages | Runtime File Size |
| :---: | :--- | :---: | :---: | :---: | :---: |
| `35` | **Andaman And Nicobar Islands** | 3 | 9 | 559 | `23 KB` |
| `28` | **Andhra Pradesh** | 28 | 688 | 17,957 | `684.6 KB` |
| `12` | **Arunachal Pradesh** | 27 | 209 | 5,491 | `194.3 KB` |
| `18` | **Assam** | 35 | 158 | 28,910 | `1121.9 KB` |
| `10` | **Bihar** | 38 | 537 | 48,927 | `1719.1 KB` |
| `22` | **Chhattisgarh** | 33 | 251 | 20,664 | `704.3 KB` |
| `7` | **Delhi** | 13 | 37 | 353 | `15.1 KB` |
| `30` | **Goa** | 3 | 12 | 429 | `14.8 KB` |
| `24` | **Gujarat** | 34 | 300 | 19,105 | `651.7 KB` |
| `6` | **Haryana** | 23 | 143 | 7,090 | `275.5 KB` |
| `2` | **Himachal Pradesh** | 12 | 193 | 21,593 | `838.5 KB` |
| `1` | **Jammu And Kashmir** | 20 | 208 | 6,857 | `227 KB` |
| `20` | **Jharkhand** | 24 | 263 | 32,737 | `1109.8 KB` |
| `29` | **Karnataka** | 31 | 240 | 30,771 | `1118 KB` |
| `32` | **Kerala** | 14 | 78 | 1,666 | `64.3 KB` |
| `37` | **Ladakh** | 2 | 15 | 248 | `8.1 KB` |
| `31` | **Lakshadweep** | 1 | 10 | 27 | `1.4 KB` |
| `23` | **Madhya Pradesh** | 55 | 445 | 57,496 | `1979.4 KB` |
| `27` | **Maharashtra** | 35 | 358 | 44,856 | `1548.1 KB` |
| `14` | **Manipur** | 16 | 65 | 3,850 | `143.2 KB` |
| `17` | **Meghalaya** | 12 | 56 | 7,203 | `262.4 KB` |
| `15` | **Mizoram** | 11 | 28 | 887 | `32.9 KB` |
| `13` | **Nagaland** | 17 | 120 | 1,554 | `58.3 KB` |
| `21` | **Odisha** | 30 | 317 | 51,800 | `1808.2 KB` |
| `34` | **Puducherry** | 2 | 8 | 129 | `5 KB` |
| `3` | **Punjab** | 23 | 97 | 13,014 | `515.6 KB` |
| `8` | **Rajasthan** | 41 | 425 | 52,589 | `1834.8 KB` |
| `11` | **Sikkim** | 6 | 19 | 485 | `17.6 KB` |
| `33` | **Tamil Nadu** | 38 | 317 | 18,681 | `709.2 KB` |
| `36` | **Telangana** | 33 | 617 | 11,308 | `424.7 KB` |
| `38` | **The Dadra And Nagar Haveli And Daman And Diu** | 3 | 3 | 101 | `3.7 KB` |
| `16` | **Tripura** | 8 | 23 | 898 | `34.5 KB` |
| `9` | **Uttar Pradesh** | 75 | 350 | 110,308 | `3943.3 KB` |
| `5` | **Uttarakhand** | 13 | 129 | 17,343 | `583.4 KB` |
| `19` | **West Bengal** | 22 | 345 | 41,005 | `1445.9 KB` |

---

## ⚡ Runtime Architecture & Performance

```text
Page Load
   ↓ Fetch /data/locations/index.json (~5 KB, 35 States Index)
State Selected (e.g. Andhra Pradesh - Code 28)
   ↓ Fetch /data/locations/states/28.json (Only ~3.1 MB loaded for AP)
District Selected (e.g. Chittoor)
   ↓ Instant zero-latency dropdown cascading from cached State JSON
Mandal Selected (e.g. Penumur)
   ↓ Instant village list population & Leaflet Map Auto-Geocoding
```

**LGD Codes Preserved**: All `state_code`, `district_code`, `sub-district_code`, and `village_code` attributes are preserved and attached to citizen grievance payloads.
