########################################################################
# Global records: DynamoDB + one Lambda + HTTP API. Idle cost is zero;
# see jeeves memory "serverless over standing servers".
########################################################################

resource "aws_dynamodb_table" "scores" {
  name         = "rakka-scores"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }
  attribute {
    name = "time"
    type = "N"
  }
  attribute {
    name = "day"
    type = "S"
  }
  attribute {
    name = "week"
    type = "S"
  }
  attribute {
    name = "month"
    type = "S"
  }
  attribute {
    name = "all"
    type = "S"
  }

  global_secondary_index {
    name            = "byDay"
    hash_key        = "day"
    range_key       = "time"
    projection_type = "ALL"
  }
  global_secondary_index {
    name            = "byWeek"
    hash_key        = "week"
    range_key       = "time"
    projection_type = "ALL"
  }
  global_secondary_index {
    name            = "byMonth"
    hash_key        = "month"
    range_key       = "time"
    projection_type = "ALL"
  }
  global_secondary_index {
    name            = "byAll"
    hash_key        = "all"
    range_key       = "time"
    projection_type = "ALL"
  }
}

data "archive_file" "records" {
  type        = "zip"
  source_file = "${path.module}/records/index.mjs"
  output_path = "${path.module}/.records.zip"
}

resource "aws_iam_role" "records" {
  name = "rakka-records-lambda"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{ Effect = "Allow", Principal = { Service = "lambda.amazonaws.com" }, Action = "sts:AssumeRole" }]
  })
}

resource "aws_iam_role_policy" "records" {
  role = aws_iam_role.records.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["dynamodb:PutItem", "dynamodb:Query"]
        Resource = [aws_dynamodb_table.scores.arn, "${aws_dynamodb_table.scores.arn}/index/*"]
      },
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}

resource "aws_lambda_function" "records" {
  function_name    = "rakka-records"
  role             = aws_iam_role.records.arn
  runtime          = "nodejs22.x"
  architectures    = ["arm64"]
  handler          = "index.handler"
  filename         = data.archive_file.records.output_path
  source_code_hash = data.archive_file.records.output_base64sha256
  timeout          = 10
  memory_size      = 256
  environment {
    variables = { TABLE = aws_dynamodb_table.scores.name }
  }
}

resource "aws_cloudwatch_log_group" "records" {
  name              = "/aws/lambda/${aws_lambda_function.records.function_name}"
  retention_in_days = 14
}

resource "aws_apigatewayv2_api" "records" {
  name          = "rakka-records"
  protocol_type = "HTTP"
  cors_configuration {
    allow_origins = ["https://vesahyp.github.io", "http://localhost:5173", "http://localhost:5198", "http://localhost:5199"]
    allow_methods = ["GET", "POST", "OPTIONS"]
    allow_headers = ["content-type"]
    max_age       = 3600
  }
}

resource "aws_apigatewayv2_integration" "records" {
  api_id                 = aws_apigatewayv2_api.records.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.records.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "top" {
  api_id    = aws_apigatewayv2_api.records.id
  route_key = "GET /top"
  target    = "integrations/${aws_apigatewayv2_integration.records.id}"
}

resource "aws_apigatewayv2_route" "rank" {
  api_id    = aws_apigatewayv2_api.records.id
  route_key = "GET /rank"
  target    = "integrations/${aws_apigatewayv2_integration.records.id}"
}

resource "aws_apigatewayv2_route" "scores" {
  api_id    = aws_apigatewayv2_api.records.id
  route_key = "POST /scores"
  target    = "integrations/${aws_apigatewayv2_integration.records.id}"
}

resource "aws_apigatewayv2_stage" "records" {
  api_id      = aws_apigatewayv2_api.records.id
  name        = "$default"
  auto_deploy = true
  default_route_settings {
    throttling_burst_limit = 20
    throttling_rate_limit  = 10
  }
}

resource "aws_lambda_permission" "records" {
  statement_id  = "AllowAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.records.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.records.execution_arn}/*/*"
}

output "records_api" {
  description = "Base URL of the records API (bake into src/api.ts)."
  value       = aws_apigatewayv2_api.records.api_endpoint
}
