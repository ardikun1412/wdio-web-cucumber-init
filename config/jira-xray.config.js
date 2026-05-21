const jiraXrayConfig = {
  issueTypes: {
    precondition: 'Pre-Condition',
    test: 'Test',
    testSet: 'Test Set',
    subTestExecution: 'Sub Test Execution'
  },

  customFields: {
    preconditionDetails: 'customfield_10232',
    preconditionType: 'customfield_10231',

    testRepositoryPath: 'customfield_10221',
    testType: 'customfield_10210',
    testingType: 'customfield_16010',

    cucumberTestSteps: 'customfield_10211',
    cucumberScenarioSteps: 'customfield_10212',

    testingGroup: 'customfield_16009',
    platform: 'customfield_10614',
    activityType: 'customfield_10560',
    atAssignee: 'customfield_14201'
  },

  defaultValues: {
    testType: { value: 'Cucumber' },
    preconditionType: { value: 'Cucumber' },
    testingGroup: { value: 'Automated Testing' },
    platform: [{ value: 'Desktop | Browser' }],
    cucumberTestSteps: { value: 'Scenario' }
  }
};

export default jiraXrayConfig;