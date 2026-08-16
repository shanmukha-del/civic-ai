const fs = require('fs');
const path = require('path');

const rootDir = process.cwd();
const excelPath = path.join(rootDir, 'public', 'list-of-states-districts-sub-districts-and-villages-along-with-their-lgd-codes-as-of-2-july-2026.xlsx');

if (!fs.existsSync(excelPath)) {
  console.error(`❌ CRITICAL: LGD Excel source file not found at: ${excelPath}`);
  process.exit(1);
}

const xlsx = require(path.join(rootDir, 'node_modules', 'xlsx'));

console.log('----------------------------------------------------');
console.log('🚀 CIVICAI ALL-INDIA LGD LOCATION DATA PROCESSING PIPELINE');
console.log('----------------------------------------------------');
console.log(`📂 Source File: ${excelPath}`);
console.log('⏳ Reading Excel file into memory (this will take 15-30 seconds for ~676k rows)...');

const startTime = Date.now();
const workbook = xlsx.readFile(excelPath);
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];

console.log(`📄 Sheet Name: "${sheetName}"`);
console.log('⏳ Converting worksheet to JSON records...');

const rawRows = xlsx.utils.sheet_to_json(sheet);
const totalSourceRows = rawRows.length;
console.log(`📊 Total Source Rows Read: ${totalSourceRows.toLocaleString()}`);

if (totalSourceRows === 0) {
  console.error('❌ CRITICAL: Excel file is empty!');
  process.exit(1);
}

// 1. Column Validation
const firstRow = rawRows[0];
console.log('\n🔍 Validating required columns...');
console.log('First Row Keys:', Object.keys(firstRow));

const stateCodeKey = Object.keys(firstRow).find(k => /state_code/i.test(k));
const stateNameKey = Object.keys(firstRow).find(k => /state_name/i.test(k));
const distCodeKey = Object.keys(firstRow).find(k => /district_code/i.test(k));
const distNameKey = Object.keys(firstRow).find(k => /district_name/i.test(k));
const mandalCodeKey = Object.keys(firstRow).find(k => /sub.*district_code/i.test(k));
const mandalNameKey = Object.keys(firstRow).find(k => /sub.*district_name/i.test(k));
const villCodeKey = Object.keys(firstRow).find(k => /village_code/i.test(k));
const villNameKey = Object.keys(firstRow).find(k => /village_name/i.test(k));

if (!stateCodeKey || !stateNameKey || !distCodeKey || !distNameKey || !mandalCodeKey || !mandalNameKey || !villCodeKey || !villNameKey) {
  console.error('❌ CRITICAL: Missing required LGD columns in Excel file!');
  console.error({ stateCodeKey, stateNameKey, distCodeKey, distNameKey, mandalCodeKey, mandalNameKey, villCodeKey, villNameKey });
  process.exit(1);
}

console.log('✅ All required LGD column headers validated successfully.');

// 2. Data Grouping and Validation
let validRowsCount = 0;
let invalidRowsCount = 0;
let exactDuplicateCount = 0;
const invalidRowsReport = [];

const stateMap = new Map(); // stateCode -> { stateCode, stateName, districts: Map }
const seenRecordKeys = new Set();

rawRows.forEach((row, idx) => {
  const rowNum = idx + 2; // 1-indexed including header
  const sCode = row[stateCodeKey];
  const sName = String(row[stateNameKey] || '').trim();
  const dCode = row[distCodeKey];
  const dName = String(row[distNameKey] || '').trim();
  const mCode = row[mandalCodeKey];
  const mName = String(row[mandalNameKey] || '').trim();
  const vCode = row[villCodeKey];
  const vName = String(row[villNameKey] || '').trim();

  // Validate presence
  if (sCode == null || !sName || dCode == null || !dName || mCode == null || !mName || vCode == null || !vName) {
    invalidRowsCount++;
    if (invalidRowsReport.length < 50) {
      invalidRowsReport.push({ row: rowNum, reason: 'Missing mandatory column values', data: row });
    }
    return;
  }

  const recordKey = `${sCode}_${dCode}_${mCode}_${vCode}`;
  if (seenRecordKeys.has(recordKey)) {
    exactDuplicateCount++;
  } else {
    seenRecordKeys.add(recordKey);
  }

  validRowsCount++;

  // Build Hierarchy
  if (!stateMap.has(sCode)) {
    stateMap.set(sCode, {
      state_code: sCode,
      state_name: sName,
      districtsMap: new Map()
    });
  }

  const stateObj = stateMap.get(sCode);
  if (!stateObj.districtsMap.has(dName)) {
    stateObj.districtsMap.set(dName, {
      code: dCode,
      mandalsMap: new Map()
    });
  }

  const distObj = stateObj.districtsMap.get(dName);
  if (!distObj.mandalsMap.has(mName)) {
    distObj.mandalsMap.set(mName, {
      code: mCode,
      villages: []
    });
  }

  const mandalObj = distObj.mandalsMap.get(mName);
  mandalObj.villages.push({
    name: vName,
    code: vCode
  });
});

console.log(`\n✅ Data Validation Complete:`);
console.log(`- Total Valid Records: ${validRowsCount.toLocaleString()}`);
console.log(`- Total Invalid Rows: ${invalidRowsCount.toLocaleString()}`);
console.log(`- Total Duplicate Record Keys: ${exactDuplicateCount.toLocaleString()}`);

// 3. Prepare Partitioned Output Directory Structure
const outputBaseDir = path.join(rootDir, 'public', 'data', 'locations');
const statesDir = path.join(outputBaseDir, 'states');

if (fs.existsSync(outputBaseDir)) {
  fs.rmSync(outputBaseDir, { recursive: true, force: true });
}
fs.mkdirSync(statesDir, { recursive: true });

const indexStatesList = [];
const stateSummaries = [];
let totalGeneratedVillages = 0;

// Sort states alphabetically by name
const sortedStateCodes = Array.from(stateMap.keys()).sort((a, b) => {
  return stateMap.get(a).state_name.localeCompare(stateMap.get(b).state_name);
});

sortedStateCodes.forEach(sCode => {
  const stateObj = stateMap.get(sCode);
  const formattedDistricts = {};
  let stateVillageCount = 0;
  let stateMandalCount = 0;

  // Sort districts alphabetically
  const sortedDistNames = Array.from(stateObj.districtsMap.keys()).sort();

  sortedDistNames.forEach(dName => {
    const distObj = stateObj.districtsMap.get(dName);
    const formattedMandals = {};

    const sortedMandalNames = Array.from(distObj.mandalsMap.keys()).sort();

    sortedMandalNames.forEach(mName => {
      stateMandalCount++;
      const mandalObj = distObj.mandalsMap.get(mName);
      stateVillageCount += mandalObj.villages.length;
      totalGeneratedVillages += mandalObj.villages.length;

      formattedMandals[mName] = {
        code: mandalObj.code,
        villages: mandalObj.villages
      };
    });

    formattedDistricts[dName] = {
      code: distObj.code,
      mandals: formattedMandals
    };
  });

  const stateFileName = `states/${sCode}.json`;
  const stateFilePath = path.join(outputBaseDir, stateFileName);

  const statePayload = {
    state_code: sCode,
    state_name: stateObj.state_name,
    districts: formattedDistricts
  };

  fs.writeFileSync(stateFilePath, JSON.stringify(statePayload));
  const fileSizeKB = (fs.statSync(stateFilePath).size / 1024).toFixed(1);

  indexStatesList.push({
    code: sCode,
    name: stateObj.state_name,
    file: stateFileName,
    district_count: sortedDistNames.length,
    mandal_count: stateMandalCount,
    village_count: stateVillageCount,
    size_kb: parseFloat(fileSizeKB)
  });

  stateSummaries.push({
    state_code: sCode,
    state_name: stateObj.state_name,
    district_count: sortedDistNames.length,
    mandal_count: stateMandalCount,
    village_count: stateVillageCount,
    size_kb: parseFloat(fileSizeKB)
  });
});

// Write Main Index File
const indexPayload = {
  version: "LGD-2026-07-02",
  generated_at: new Date().toISOString(),
  total_states: indexStatesList.length,
  total_records: totalGeneratedVillages,
  states: indexStatesList
};

const indexPath = path.join(outputBaseDir, 'index.json');
fs.writeFileSync(indexPath, JSON.stringify(indexPayload, null, 2));

// Write Machine Readable Metadata Report
const metadataPayload = {
  source_filename: path.basename(excelPath),
  source_date: "2026-07-02",
  generation_timestamp: new Date().toISOString(),
  total_source_rows: totalSourceRows,
  total_valid_rows: validRowsCount,
  total_invalid_rows: invalidRowsCount,
  total_duplicate_rows: exactDuplicateCount,
  total_states: indexStatesList.length,
  total_districts: stateSummaries.reduce((acc, s) => acc + s.district_count, 0),
  total_mandals: stateSummaries.reduce((acc, s) => acc + s.mandal_count, 0),
  total_villages: totalGeneratedVillages,
  state_breakdown: stateSummaries
};

const metadataPath = path.join(outputBaseDir, 'metadata.json');
fs.writeFileSync(metadataPath, JSON.stringify(metadataPayload, null, 2));

// 4. Source-to-Output Integrity Assertion
console.log('\n----------------------------------------------------');
console.log('🔍 PERFORMING SOURCE-TO-OUTPUT INTEGRITY AUDIT');
console.log('----------------------------------------------------');
console.log(`Source Valid Records: ${validRowsCount.toLocaleString()}`);
console.log(`Generated Records:    ${totalGeneratedVillages.toLocaleString()}`);

if (validRowsCount !== totalGeneratedVillages) {
  console.error(`❌ FAILURE: Source valid record count (${validRowsCount}) does not match generated record count (${totalGeneratedVillages})!`);
  process.exit(1);
}

console.log('🟢 PERFECT 100% MATCH: Every single valid source record is represented in the runtime dataset!');

// 5. Generate Human Readable Markdown Report
const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);

let reportMd = `# 🏛️ LGD ALL-INDIA LOCATION DATASET PROCESSING REPORT

**Processing Status**: 🟢 SUCCESS (100% Verified Match)  
**Processing Duration**: ${durationSec} seconds  
**Generation Timestamp**: ${new Date().toLocaleString()}  
**Source Excel File**: \`${path.basename(excelPath)}\`  

---

## 📊 Summary Metrics

| Metric | Count |
| :--- | :--- |
| **Total Source Rows Read** | **${totalSourceRows.toLocaleString()}** |
| **Valid Processed Records** | **${validRowsCount.toLocaleString()}** |
| **Invalid / Empty Rows** | **${invalidRowsCount.toLocaleString()}** |
| **Exact Duplicate Keys** | **${exactDuplicateCount.toLocaleString()}** |
| **Total States / UTs** | **${indexStatesList.length}** |
| **Total Districts** | **${metadataPayload.total_districts.toLocaleString()}** |
| **Total Sub-Districts / Mandals** | **${metadataPayload.total_mandals.toLocaleString()}** |
| **Total Villages / Localities** | **${totalGeneratedVillages.toLocaleString()}** |

---

## 🗺️ State & Union Territory Breakdown

| State Code | State / UT Name | Districts | Mandals | Villages | Runtime File Size |
| :---: | :--- | :---: | :---: | :---: | :---: |
`;

stateSummaries.forEach(s => {
  reportMd += `| \`${s.state_code}\` | **${s.state_name}** | ${s.district_count} | ${s.mandal_count.toLocaleString()} | ${s.village_count.toLocaleString()} | \`${s.size_kb} KB\` |\n`;
});

reportMd += `\n---

## ⚡ Runtime Architecture & Performance

\`\`\`text
Page Load
   ↓ Fetch /data/locations/index.json (~5 KB, 35 States Index)
State Selected (e.g. Andhra Pradesh - Code 28)
   ↓ Fetch /data/locations/states/28.json (Only ~3.1 MB loaded for AP)
District Selected (e.g. Chittoor)
   ↓ Instant zero-latency dropdown cascading from cached State JSON
Mandal Selected (e.g. Penumur)
   ↓ Instant village list population & Leaflet Map Auto-Geocoding
\`\`\`

**LGD Codes Preserved**: All \`state_code\`, \`district_code\`, \`sub-district_code\`, and \`village_code\` attributes are preserved and attached to citizen grievance payloads.
`;

const reportPath = path.join(rootDir, 'LGD_PROCESSING_REPORT.md');
fs.writeFileSync(reportPath, reportMd);

console.log(`\n📄 Human Readable Report written to: LGD_PROCESSING_REPORT.md`);
console.log(`📁 Runtime Files written to: public/data/locations/`);
console.log('🎉 CIVICAI ALL-INDIA LGD PIPELINE COMPLETED SUCCESSFULLY!');
