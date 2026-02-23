function submitAllDestinations(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid payload.");
  }

  validateUnifiedPayload_(payload);
  const task = getTaskByName_(payload.taskName);

  return withScriptLock_(function () {
    const activeUserEmail = Session.getActiveUser().getEmail() || "";
    const email = resolveOperatorEmail_(payload, activeUserEmail);
    const now = new Date();
    const liEntries = buildLanguageInstructionEntries_(payload, task);

    const sessionInputsResult = writeSessionInputs_(payload, email, now, liEntries);
    const outputTrackerResult = writeOutputTracker_(payload, email, now, liEntries);
    const meshcatTrackerResult = writeMeshcatTracker_(payload, email, now, liEntries);

    return {
      ok: true,
      sessionInputs: sessionInputsResult,
      outputTracker: outputTrackerResult,
      meshcatTracker: meshcatTrackerResult,
      email: email
    };
  });
}

function resolveOperatorEmail_(payload, fallbackEmail) {
  const selectedEmail = String(payload.operatorEmail || "").trim();
  if (selectedEmail) {
    return selectedEmail;
  }

  return fallbackEmail || "";
}

function validateUnifiedPayload_(payload) {
  const requiredTopFields = ["operatorName", "teamLeader", "taskName", "submissionMode", "workstation"];
  for (let index = 0; index < requiredTopFields.length; index++) {
    const field = requiredTopFields[index];
    if (payload[field] === undefined || payload[field] === null || String(payload[field]).trim() === "") {
      throw new Error("Missing required field: " + field);
    }
  }

  if (CONFIG.OPERATORS.indexOf(payload.operatorName) === -1) {
    throw new Error("Invalid operator name.");
  }

  if (CONFIG.TEAM_LEADERS.indexOf(payload.teamLeader) === -1) {
    throw new Error("Invalid team leader.");
  }

  if (CONFIG.WORKSTATIONS.indexOf(payload.workstation) === -1) {
    throw new Error("Invalid workstation.");
  }

  const task = getTaskByName_(payload.taskName);
  if (!task) {
    throw new Error("Invalid task name.");
  }

  const submissionMode = String(payload.submissionMode);
  if (submissionMode !== "single" && submissionMode !== "both") {
    throw new Error("Invalid submission mode.");
  }

  if (submissionMode === "single") {
    validateSingleLiPayload_(payload, task);
  } else {
    validateBothLiPayload_(payload, task);
  }
}

function validateSingleLiPayload_(payload, task) {
  const selectedLi = String(payload.singleLi || "").trim();
  if (!selectedLi) {
    throw new Error("Language Instruction is required for single submission mode.");
  }

  if (task.liOptions.indexOf(selectedLi) === -1) {
    throw new Error("Selected Language Instruction is not valid for this task.");
  }

  const sessionId = String(payload.singleSessionId || "").trim();
  if (!sessionId) {
    throw new Error("Session ID is required for single submission mode.");
  }

  const output = Number(payload.singleOutput);
  if (!Number.isFinite(output) || output < 0) {
    throw new Error("Output must be a non-negative number for single submission mode.");
  }

  const duration = Number(payload.singleDurationMinutes);
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("Total duration must be a positive number for single submission mode.");
  }
}

function validateBothLiPayload_(payload, task) {
  const supportsLi1 = task.liOptions.indexOf("LI 1") !== -1;
  const supportsLi2 = task.liOptions.indexOf("LI 2") !== -1;
  if (!supportsLi1 || !supportsLi2) {
    throw new Error("This task does not support both LI 1 and LI 2.");
  }

  const li1SessionId = String(payload.li1SessionId || "").trim();
  const li2SessionId = String(payload.li2SessionId || "").trim();
  if (!li1SessionId || !li2SessionId) {
    throw new Error("Both LI 1 and LI 2 session IDs are required.");
  }

  const li1Output = Number(payload.li1Output);
  const li2Output = Number(payload.li2Output);
  if (!Number.isFinite(li1Output) || li1Output < 0) {
    throw new Error("LI 1 output must be a non-negative number.");
  }

  if (!Number.isFinite(li2Output) || li2Output < 0) {
    throw new Error("LI 2 output must be a non-negative number.");
  }

  const li1Duration = Number(payload.li1DurationMinutes);
  const li2Duration = Number(payload.li2DurationMinutes);
  if (!Number.isFinite(li1Duration) || li1Duration <= 0) {
    throw new Error("LI 1 total duration must be a positive number.");
  }

  if (!Number.isFinite(li2Duration) || li2Duration <= 0) {
    throw new Error("LI 2 total duration must be a positive number.");
  }
}

function buildLanguageInstructionEntries_(payload, task) {
  if (payload.submissionMode === "single") {
    return [
      {
        liKey: String(payload.singleLi).trim(),
        languageInstruction: resolveLanguageInstruction_(task, String(payload.singleLi).trim()),
        sessionId: String(payload.singleSessionId).trim(),
        output: Number(payload.singleOutput),
        durationMinutes: Number(payload.singleDurationMinutes)
      }
    ];
  }

  return [
    {
      liKey: "LI 1",
      languageInstruction: resolveLanguageInstruction_(task, "LI 1"),
      sessionId: String(payload.li1SessionId).trim(),
      output: Number(payload.li1Output),
      durationMinutes: Number(payload.li1DurationMinutes)
    },
    {
      liKey: "LI 2",
      languageInstruction: resolveLanguageInstruction_(task, "LI 2"),
      sessionId: String(payload.li2SessionId).trim(),
      output: Number(payload.li2Output),
      durationMinutes: Number(payload.li2DurationMinutes)
    }
  ];
}

function writeSessionInputs_(payload, email, now, liEntries) {
  const destination = CONFIG.SESSION_INPUTS;
  const sheet = openDestinationSheet_(destination, "SessionInputs");
  const rows = buildSessionInputsRows_(payload, email, now, liEntries, destination);
  const startRow = writeRowsToNextEmpty_(
    sheet,
    destination.DATA_START_ROW,
    destination.MAX_COLUMN,
    rows,
    destination.EMPTY_CHECK_COLUMNS
  );

  return {
    startRow: startRow,
    rowsWritten: rows.length,
    destination: destination.SHEET_NAME
  };
}

function buildSessionInputsRows_(payload, email, now, liEntries, destination) {
  const columns = destination.COLUMNS;
  const rows = [];

  for (let entryIndex = 0; entryIndex < liEntries.length; entryIndex++) {
    const entry = liEntries[entryIndex];
    const row = new Array(destination.MAX_COLUMN).fill("");

    row[columns.DATE - 1] = now;
    row[columns.TASK_NAME - 1] = String(payload.taskName).trim();
    row[columns.SESSION_ID - 1] = entry.sessionId;
    row[columns.OPERATOR_NAME - 1] = String(payload.operatorName).trim();
    row[columns.EMAIL_ID - 1] = email;
    row[columns.TEAM_LEADER - 1] = String(payload.teamLeader).trim();

    rows.push(row);
  }

  return rows;
}

function writeOutputTracker_(payload, email, now, liEntries) {
  const destination = CONFIG.OUTPUT_TRACKER;
  const sheet = openDestinationSheet_(destination, "Output Tracker");
  const rows = buildOutputTrackerRows_(payload, email, now, liEntries, destination);
  const startRow = writeRowsToNextEmpty_(
    sheet,
    destination.DATA_START_ROW,
    destination.MAX_COLUMN,
    rows,
    destination.EMPTY_CHECK_COLUMNS
  );

  return {
    startRow: startRow,
    rowsWritten: rows.length,
    destination: destination.SHEET_NAME
  };
}

function buildOutputTrackerRows_(payload, email, now, liEntries, destination) {
  const columns = destination.COLUMNS;
  const rows = [];
  const timestampText = formatTimestamp_(now);
  const dateText = formatDateOnly_(now);

  for (let entryIndex = 0; entryIndex < liEntries.length; entryIndex++) {
    const entry = liEntries[entryIndex];
    const row = new Array(destination.MAX_COLUMN).fill("");

    row[columns.TIMESTAMP - 1] = timestampText;
    row[columns.EMAIL_ADDRESS - 1] = email;
    row[columns.DATE - 1] = dateText;
    row[columns.TASK_NAME - 1] = String(payload.taskName).trim();
    row[columns.WORKSTATION - 1] = String(payload.workstation).trim();
    row[columns.OPERATOR_NAME - 1] = String(payload.operatorName).trim();
    row[columns.LANGUAGE_INSTRUCTION - 1] = entry.liKey;
    row[columns.OUTPUT - 1] = entry.output;
    row[columns.TOTAL_DURATION - 1] = entry.durationMinutes;

    rows.push(row);
  }

  return rows;
}

function writeMeshcatTracker_(payload, email, now, liEntries) {
  const destination = CONFIG.MESHCAT_TRACKER;
  const sheet = openDestinationSheet_(destination, "Meshcat Tracker");
  const rows = buildMeshcatTrackerRows_(payload, email, now, liEntries, destination);
  const startRow = writeRowsToNextEmpty_(
    sheet,
    destination.DATA_START_ROW,
    destination.MAX_COLUMN,
    rows,
    destination.EMPTY_CHECK_COLUMNS
  );

  applyMeshcatDisplayFormatting_(sheet, destination, startRow, rows.length);

  return {
    startRow: startRow,
    rowsWritten: rows.length,
    destination: destination.SHEET_NAME
  };
}

function buildMeshcatTrackerRows_(payload, email, now, liEntries, destination) {
  const columns = destination.COLUMNS;
  const rows = [];
  const timestampText = formatTimestamp_(now);
  const gearNumber = extractGearNumber_(payload.workstation);

  for (let entryIndex = 0; entryIndex < liEntries.length; entryIndex++) {
    const entry = liEntries[entryIndex];
    const row = new Array(destination.MAX_COLUMN).fill("");

    row[columns.TIMESTAMP - 1] = timestampText;
    row[columns.GEAR_NO - 1] = gearNumber;
    row[columns.EMAIL_ADDRESS - 1] = email;
    row[columns.TEAM_LEADER - 1] = String(payload.teamLeader).trim();
    row[columns.TASK_NAME - 1] = entry.languageInstruction;
    row[columns.SESSION_ID - 1] = entry.sessionId;
    row[columns.OUTPUT - 1] = entry.output;

    rows.push(row);
  }

  return rows;
}

function applyMeshcatDisplayFormatting_(sheet, destination, startRow, rowCount) {
  const rowsToFormat = Math.max(1, Number(rowCount) || 1);
  const columns = destination.COLUMNS;

  sheet
    .getRange(startRow, columns.GEAR_NO, rowsToFormat, 1)
    .setHorizontalAlignment("right");
}

function openDestinationSheet_(destination, destinationName) {
  if (!destination.SPREADSHEET_ID || destination.SPREADSHEET_ID.indexOf("PUT_") === 0) {
    throw new Error(destinationName + " spreadsheet ID is not configured.");
  }

  const spreadsheet = SpreadsheetApp.openById(destination.SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName(destination.SHEET_NAME);
  if (!sheet) {
    throw new Error(destinationName + " sheet not found: " + destination.SHEET_NAME);
  }

  return sheet;
}

function writeRowsToNextEmpty_(sheet, startRow, maxColumn, rows, emptyCheckColumns) {
  normalizeSheetVisibilityForWrite_(sheet);

  const targetRow = findNextWritableRow_(
    sheet,
    startRow,
    maxColumn,
    emptyCheckColumns,
    rows.length
  );

  ensureRowsVisible_(sheet, targetRow, rows.length);
  sheet.getRange(targetRow, 1, rows.length, maxColumn).setValues(rows);
  return targetRow;
}

function normalizeSheetVisibilityForWrite_(sheet) {
  const filter = sheet.getFilter();
  if (filter) {
    filter.remove();
  }

  try {
    sheet.expandAllRowGroups();
  } catch (error) {
  }
}

function ensureRowsVisible_(sheet, startRow, rowCount) {
  const rowsToCheck = Math.max(1, Number(rowCount) || 1);
  for (let offset = 0; offset < rowsToCheck; offset++) {
    const rowNumber = startRow + offset;
    if (sheet.isRowHiddenByUser(rowNumber)) {
      sheet.showRows(rowNumber, 1);
    }
  }
}

function formatTimestamp_(dateValue) {
  const timezone = Session.getScriptTimeZone() || "Asia/Manila";
  return Utilities.formatDate(dateValue, timezone, "M/d/yyyy HH:mm:ss");
}

function formatDateOnly_(dateValue) {
  const timezone = Session.getScriptTimeZone() || "Asia/Manila";
  return Utilities.formatDate(dateValue, timezone, "M/d/yyyy");
}

function extractGearNumber_(workstation) {
  const text = String(workstation || "");
  const match = text.match(/(\d+)/);
  if (!match) {
    return "";
  }

  const parsed = parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : "";
}

function getTaskByName_(taskName) {
  const instructions = (CONFIG.TASK_REF || {})[taskName];
  if (!Array.isArray(instructions) || instructions.length === 0) {
    return null;
  }

  const liEntries = instructions.map(function (instruction, index) {
    return {
      value: "LI " + (index + 1),
      instruction: instruction
    };
  });

  return {
    name: taskName,
    liOptions: liEntries.map(function (entry) {
      return entry.value;
    }),
    liEntries: liEntries
  };
}

function resolveLanguageInstruction_(task, liKey) {
  if (!task || !Array.isArray(task.liEntries)) {
    return liKey;
  }

  for (let index = 0; index < task.liEntries.length; index++) {
    const entry = task.liEntries[index];
    if (entry.value === liKey) {
      return entry.instruction;
    }
  }

  return liKey;
}

function withScriptLock_(callback) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    return callback();
  } finally {
    lock.releaseLock();
  }
}

function findFirstCompletelyEmptyRow_(sheet, startRow, maxColumn) {
  const batchSize = 200;
  let currentRow = startRow;

  while (true) {
    const rowsAvailable = sheet.getMaxRows() - currentRow + 1;
    if (rowsAvailable <= 0) {
      sheet.insertRowsAfter(sheet.getMaxRows(), batchSize);
      continue;
    }

    const rowsToRead = Math.min(batchSize, rowsAvailable);
    const values = sheet.getRange(currentRow, 1, rowsToRead, maxColumn).getValues();

    for (let index = 0; index < values.length; index++) {
      if (isRowEmpty_(values[index])) {
        return currentRow + index;
      }
    }

    currentRow += rowsToRead;
  }
}

function findNextWritableRow_(sheet, startRow, maxColumn, emptyCheckColumns, requiredRows) {
  const checkColumns = normalizeCheckColumns_(emptyCheckColumns, maxColumn);
  const minCheckColumn = checkColumns[0];
  const maxCheckColumn = checkColumns[checkColumns.length - 1];
  const checkWidth = maxCheckColumn - minCheckColumn + 1;
  const batchSize = 400;
  const neededRows = Math.max(1, Number(requiredRows) || 1);
  let currentRow = Math.max(1, startRow);
  let emptyStreak = 0;
  let streakStartRow = currentRow;
  const existingMaxRows = sheet.getMaxRows();

  while (currentRow <= existingMaxRows) {
    const rowsAvailable = existingMaxRows - currentRow + 1;

    const rowsToRead = Math.min(batchSize, rowsAvailable);
    const values = sheet.getRange(currentRow, minCheckColumn, rowsToRead, checkWidth).getValues();

    for (let offset = 0; offset < values.length; offset++) {
      const rowNumber = currentRow + offset;
      if (isRowEmptyByColumns_(values[offset], checkColumns, minCheckColumn)) {
        if (emptyStreak === 0) {
          streakStartRow = rowNumber;
        }

        emptyStreak += 1;
        if (emptyStreak >= neededRows) {
          return streakStartRow;
        }
      } else {
        emptyStreak = 0;
      }
    }

    currentRow += rowsToRead;
  }

  const appendStartRow = existingMaxRows + 1;
  sheet.insertRowsAfter(existingMaxRows, neededRows);
  return appendStartRow;
}

function normalizeCheckColumns_(emptyCheckColumns, maxColumn) {
  if (!Array.isArray(emptyCheckColumns) || emptyCheckColumns.length === 0) {
    const fallback = [];
    for (let column = 1; column <= maxColumn; column++) {
      fallback.push(column);
    }
    return fallback;
  }

  return emptyCheckColumns.slice().sort(function (left, right) {
    return left - right;
  });
}

function isRowEmptyByColumns_(rowValues, checkColumns, startColumn) {
  for (let index = 0; index < checkColumns.length; index++) {
    const absoluteColumn = checkColumns[index];
    const value = rowValues[absoluteColumn - startColumn];
    if (!isCellEmpty_(value)) {
      return false;
    }
  }
  return true;
}

function isCellEmpty_(value) {
  if (value === "" || value === null || value === undefined) {
    return true;
  }

  if (typeof value === "string") {
    return value.trim() === "";
  }

  return false;
}

function isRowEmpty_(rowValues) {
  for (let index = 0; index < rowValues.length; index++) {
    const value = rowValues[index];
    if (value !== "" && value !== null) {
      return false;
    }
  }
  return true;
}
