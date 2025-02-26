# Aeon - Event Sourcing with DynamoDB

Aeon is an experimental serverless event store built on AWS DynamoDB, designed to explore event sourcing, CQRS, and event-driven architectures. Implemented as a TypeScript library and an AWS CDK construct, Aeon makes it easy to deploy and experiment with event stores in your own AWS environment. If you’re curious about strong event ordering, optimistic concurrency, and eventual consistency, Aeon provides a hands-on way to dive in without the complexity of a full-scale framework.

Some things you can explore:

* 💪 **Strong event ordering** – See how events can be stored and retrieved in a strict sequence.
* 🍀 **Optimistic concurrency** – Learn how to handle concurrent writes without conflicts.
* ⌛ **Manage eventual consistency** – Experiment with tracking seen event revisions for CQRS read models.
* 🗄️ **Built on DynamoDB** – Understand the trade-offs of using a NoSQL database for event sourcing.
* 🚀 **Easy deployment** – Use the AWS CDK construct to quickly set up an event store in your own AWS account.

Aeon isn’t production-ready. It’s a playground for learning and experimenting with event-driven patterns. If you’re exploring event sourcing and want to see how these ideas work in practice, give it a try!

## Examples

1. 🤨 [counter-basic](examples/counter-basic/) - A basic event sourced counter with a command API to increment & decrement counters, and a query API that answers queries inefficiently by replaying a counter's entire event history.
1. 😊 [counter-cqrs](examples/counter-cqrs/) - builds on counter-basic by adding a separate, optimized read model and a new query API that answers queries using the read model.
1. 😇 [counter-cqrs-lazy](examples/counter-cqrs-lazy/) - similar to counter-cqrs, but uses a lazy read-through (pull) strategy to update its read model instead of a subscription (push) strategy. 
1. 😁 [counter-optimistic-concurrency](examples/counter-optimistic-concurrency/) - builds on counter-cqrs by adding a new command handler that uses optimistic concurrency control to ensure counter events are only appended when their history hasn't changed.
1. 🥳 [counter-snapshot](examples/counter-snapshot/) - builds on counter-optimistic-concurrency by adding a new command handler that uses snapshots to update a counter without needing to read its entire history.
1. 🍦 [event-sourcing-diy](examples/event-sourcing-diy/) - ice cream truck example from [The Dev Owl](https://www.youtube.com/@TheDevOwl)'s [Event Sourcing DIY YouTube series](https://www.youtube.com/watch?v=zyp9pZ7jeK8&list=PL-nSd-yeckKh7Ts5EKChek7iXcgyUGDHa)

### Deploying examples

To deploy an example into your AWS account

1. You'll need:
   1. [An AWS account and AWS command line credentials setup](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-quickstart.html#getting-started-quickstart-new)
   2. [NodeJS >= 22.12.0 or higher](https://nodejs.org/en/download)
1. Clone the repo
2. `npm install`
3. `cd examples/<example to deploy>`
4. `npx cdk deploy --all`

### Destroying (undeploying) examples

To remove a deployed example from your AWS account

3. `cd examples/<example to deploy>`
4. `npx cdk destroy --all`

## API

**The best way to learn the API is to [look through the examples](#examples).**

There are really two APIs:

1. Software API (TypeScript aws-_sdk_) - used to implement your application, i.e. reading and appending events in the course of implementing your business logic, read models, etc.
2. Infrastructure API (TypeScript aws-_cdk_) - used to deploy your infrastructure and applicaton, i.e. creating and deploying a DynamoDB event store in AWS, etc.

## Resources & Inspirations

* [Greg Young - Event Sourcing - GOTO 2014](https://youtu.be/8JKjvY4etTY?si=wAnuTauSWKitKhWe)
* [In-Depth Look at Event Sourcing with CQRS Architecture & Design • Sebastian von Conrad • YOW! 2017](https://youtu.be/8eNhJPjZSsY?si=N__A8_BORbzCCoXc)
* [Kurrent](kurrent.io) - Event-native platform for event sourcing
