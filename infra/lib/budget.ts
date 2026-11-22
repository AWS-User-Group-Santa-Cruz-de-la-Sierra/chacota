import * as budgets from 'aws-cdk-lib/aws-budgets';
import { Construct } from 'constructs';

/** Monthly cost guardrail: emails at 80% actual and 100% forecasted spend. */
export class ChacotaBudget extends Construct {
  constructor(scope: Construct, id: string, props: { name: string; monthlyUsd: number; email: string }) {
    super(scope, id);
    const subscribers = [{ subscriptionType: 'EMAIL', address: props.email }];
    new budgets.CfnBudget(this, 'Monthly', {
      budget: {
        budgetName: props.name,
        budgetType: 'COST',
        timeUnit: 'MONTHLY',
        budgetLimit: { amount: props.monthlyUsd, unit: 'USD' },
      },
      notificationsWithSubscribers: [
        {
          notification: { notificationType: 'ACTUAL', comparisonOperator: 'GREATER_THAN', threshold: 80, thresholdType: 'PERCENTAGE' },
          subscribers,
        },
        {
          notification: { notificationType: 'FORECASTED', comparisonOperator: 'GREATER_THAN', threshold: 100, thresholdType: 'PERCENTAGE' },
          subscribers,
        },
      ],
    });
  }
}
