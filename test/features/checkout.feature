Feature: SauceDemo End to End Checkout
  As a SauceDemo user
  I want to buy products
  So that I can complete checkout successfully

  Background: User is logged in
    Given user is on the login page
    And user logs in with username "standard_user" and password "secret_sauce"
    Then user should be redirected to the inventory page
@smoke @L3
  Scenario: User successfully checkout one product
    When user adds product "Sauce Labs Backpack" to the cart
    And user opens the cart page
    Then user should see product "Sauce Labs Backpack" in the cart
    When user proceeds to checkout
    And user fills checkout information with first name "Agra", last name "Ardiyanto", and postal code "12345"
    And user continues checkout
    Then user should see checkout overview
    And user should see product "Sauce Labs Backpack" in checkout overview
    When user finishes the checkout
    Then user should see order confirmation message "Thank you for your order!"

  @smoke @L3
  Scenario: User successfully checkout two products
    When user adds product "Sauce Labs Backpack" to the cart
    And user adds product "Sauce Labs Bike Light" to the cart
    And user opens the cart page
    Then user should see product "Sauce Labs Backpack" in the cart
    And user should see product "Sauce Labs Bike Light" in the cart
    When user proceeds to checkout
    And user fills checkout information with first name "Agra", last name "Ardiyanto", and postal code "12345"
    And user continues checkout
    Then user should see checkout overview
    And user should see product "Sauce Labs Backpack" in checkout overview
    And user should see product "Sauce Labs Bike Light" in checkout overview
    When user finishes the checkout
    Then user should see order confirmation message "Thank you for your order!"