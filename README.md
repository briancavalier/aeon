# Aeon - Event Sourcing with DynamoDB

Aeon is an experimental serverless event store built on AWS DynamoDB, designed to explore event sourcing, CQRS, and event-driven architectures. Implemented as a TypeScript library and an AWS CDK construct, Aeon makes it easy to deploy and experiment with event stores in your own AWS environment. If you’re curious about strong event ordering, optimistic concurrency, and eventual consistency, Aeon provides a hands-on way to dive in without the complexity of a full-scale framework.

Some things you can explore:

* **Strong event ordering** – See how events can be stored and retrieved in a strict sequence.
* **Optimistic concurrency** – Learn how to handle concurrent writes without conflicts.
* **Manage eventual consistency** – Experiment with tracking seen event revisions for CQRS read models.
* **Built on DynamoDB** – Understand the trade-offs of using a NoSQL database for event sourcing.
* **Easy deployment** – Use the AWS CDK construct to quickly set up an event store in your own AWS account.

Aeon isn’t production-ready—it’s a playground for learning and experimenting with event-driven patterns. If you’re exploring event sourcing and want to see how these ideas work in practice, give it a try!

