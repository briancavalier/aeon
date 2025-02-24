# Event Soucing DIY

The ice cream truck example from [The Dev Owl](https://www.youtube.com/@TheDevOwl)'s [Event Sourcing DIY YouTube series](https://www.youtube.com/watch?v=zyp9pZ7jeK8&list=PL-nSd-yeckKh7Ts5EKChek7iXcgyUGDHa).

The version implemented here is the one that the series ends up with in episide 06, plus the queries from the [How to write a Query Handler Part 2](https://youtu.be/przz3vuAf_M?si=hSQF73OK1Yag2uxJ) episode.

I tried to reproduce the domain as presented in the series as closely as possible in TypeScript.

## Differences from the videos

This example implements some details of the command and query handlers in a style that aligns with Aeon's goals and API.  For example:

1. The business logic behaviors implemented in the series are represented as a discriminated union (F# sum type) of commands and a function to produce new events given a command.
1. It makes use of features like revision tracking and optimistic concurrency that were outside the scope of the YouTube series.
1. Rather than a menu-drive CLI, there are separate cli scripts for each operation.

## Getting started

Create the event store in AWS:

1. You'll need:
   1. [An AWS account and AWS command line credentials setup](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-quickstart.html#getting-started-quickstart-new)
   2. [NodeJS >= 22.12.0 or higher](https://nodejs.org/en/download)
1. `cd examples/event-store-diy`
1. `npx cdk deploy`

## CLI

The CLI is runnable scripts:

* **cli/restock.mts** - restock a flavour in a specific truck
   * `cli/restock.mts Vanilla 3 truck/1` - add 3 Vanilla to truck 1
* **cli/sell.mts** - sell a flavour from a specific truck
   * `cli/sell.mts Vanilla truck/1` - sell 1 Vanilla from truck 1
* **cli/query-stock.mts** - query the current stock of a flavour from a specific truck
   * `cli/query-stock.mts Vanilla truck/1` - show how many Vanilla are in stock on truck 1
* **cli/query-sold.mts** - query how many of a flavour have been sold from a specific truck
   * `cli/query-stock.mts Vanilla truck/1` - show how many Vanilla have been sold from truck 1
* **cli/history.mts** - show the event history for a specific truck, _or_ from all trucks
   * `cli/history.mts truck/1` - show the event history of truck 1
   * `cli/history.mts` - show the event history of all trucks
