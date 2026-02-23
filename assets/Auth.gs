function getCurrentUser() {
  const email = Session.getActiveUser().getEmail() || "";
  return {
    email: email,
    isAuthenticated: email !== ""
  };
}

function getFormMeta() {
  function toArray_(value) {
    return Array.isArray(value) ? value.slice() : [];
  }

  function toObject_(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  const user = getCurrentUser();
  const taskNames = Object.keys(CONFIG.TASK_REF || {}).sort();
  const tasks = taskNames.map(function (taskName) {
    const instructions = CONFIG.TASK_REF[taskName] || [];
    const liEntries = instructions.map(function (instruction, index) {
      const liKey = "LI " + (index + 1);
      return {
        value: liKey,
        label: liKey + " - " + instruction,
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
  });

  return {
    email: user.email,
    teamLeaders: toArray_(CONFIG.TEAM_LEADERS),
    operators: toArray_(CONFIG.OPERATORS),
    operatorEmails: toObject_(CONFIG.OPERATOR_EMAILS),
    workstations: toArray_(CONFIG.WORKSTATIONS),
    tasks: tasks,
    submissionModes: toArray_(CONFIG.SUBMISSION_MODES).map(function (mode) {
      return {
        value: mode.value,
        label: mode.label
      };
    }),
    languageInstructions: toArray_(CONFIG.LANGUAGE_INSTRUCTIONS),
    episodeCount: Number(CONFIG.EPISODE_COUNT) || 0,
    sessionInputsDisabled: true
  };
}
