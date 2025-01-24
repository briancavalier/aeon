# Aeon

DynamoDB Event Store

1. [Examples](#examples)

## Examples

1. [How to deploy](#how-to-deploy)
1. Examples
   1. [counter](#counter) - simple counters with event sourcing and CQRS
   1. [counter-notify](#counter-notify) - adds event store notifications to build an optimize view
   1. [counter-snapshot](#counter-snapshot) - adds snapshots to optimize counters

### How to deploy

#### Prerequisites

1. Ensure your AWS credentials are setup for the AWS environment where you want to deploy the example
2. `npm install`

#### Deploying an example

2. `cd <example dir>`
3. `npx cdk deploy`

The example will be deployed to your AWS account

#### Destroying an example

2. `cd <example dir>`
3. `npx cdk destroy`

The example will be removed from your AWS account

### counter

Simple counters implemented using event sourcing and CQRS.

This is a good introduction to Aeon event stores, event sourcing, and CQRS, and it isn't intended to be a "realistic" example. You can increment and decrement a counter by posting to the Command API, and get the current value of a counter from the Query API.

```sh
# Increment and decrement a counter named my-counter
> curl --json '{"key":"my-counter", "type":"increment" }' <commandUrl from cdk output>
<event store commit revision>

> curl --json '{"key":"my-counter", "type":"increment" }' <commandUrl from cdk output>
<event store commit revision>

> curl --json '{"key":"my-counter", "type":"decrement" }' <commandUrl from cdk output>
<event store commit revision>

> curl --json '{"key":"my-counter", "type":"increment" }' <commandUrl from cdk output>
<event store commit revision>

# Query my-counter
> curl '<queryUrl from cdk output>?key=1'
{"decrements":1,"value":3,"key":"1","increments":4}
```

### counter-notify

_WIP_

### counter-snapshot
