# The wallet alarm for rakka (keitos/infra/budget.tf is the shape): every
# cost tagged project=rakka, which is the pixel distribution, the logs and
# the records API. Normal months are cents; a portal feature at 100,000
# runs a day is about $10. The alarm only emails; the response is a human
# looking at Cost Explorer grouped by tag:project.

variable "budget_alert_email" {
  description = "Where the rakka budget notifications go."
  type        = string
  default     = "vesa.hypponen@gmail.com"
}

variable "rakka_monthly_budget_usd" {
  description = "Monthly rakka spend, in USD, that counts as a surprise."
  type        = string
  default     = "20"
}

resource "aws_budgets_budget" "rakka" {
  name         = "rakka-monthly"
  budget_type  = "COST"
  limit_amount = var.rakka_monthly_budget_usd
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  cost_filter {
    name   = "TagKeyValue"
    values = ["user:project$rakka"]
  }

  # The forecast warns while there is still time to act; the two actuals
  # say it happened.
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = [var.budget_alert_email]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 50
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.budget_alert_email]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.budget_alert_email]
  }
}
