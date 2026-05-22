Feature: SauceDemo Login
  As a SauceDemo user
  I want to log in
  So that I can access the application

  @smoke @L2
  Scenario Outline: Login with valid and invalid user data
    Given user opens SauceDemo login page
    When user logs in using "<userAlias>" credential data
    Then login result should be "<expectedResult>" for "<userAlias>"

    Examples:
      | userAlias     | expectedResult |
      | validUser     | success        |
      | lockedOutUser | error          |
