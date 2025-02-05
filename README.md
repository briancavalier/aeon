# Aeon - Event Sourcing with DynamoDB

Aeon is an experimental serverless event store built on AWS DynamoDB, designed to explore event sourcing, CQRS, and event-driven architectures. Implemented as a TypeScript library and an AWS CDK construct, Aeon makes it easy to deploy and experiment with event stores in your own AWS environment. If you’re curious about strong event ordering, optimistic concurrency, and eventual consistency, Aeon provides a hands-on way to dive in without the complexity of a full-scale framework.

Some things you can explore:

* 💪 **Strong event ordering** – See how events can be stored and retrieved in a strict sequence.
* 🍀 **Optimistic concurrency** – Learn how to handle concurrent writes without conflicts.
* ⌛ **Manage eventual consistency** – Experiment with tracking seen event revisions for CQRS read models.
* 🗄️ **Built on DynamoDB** – Understand the trade-offs of using a NoSQL database for event sourcing.
* 🚀 **Easy deployment** – Use the AWS CDK construct to quickly set up an event store in your own AWS account.

Aeon isn’t production-ready—it’s a playground for learning and experimenting with event-driven patterns. If you’re exploring event sourcing and want to see how these ideas work in practice, give it a try!

## Examples

1. 🤨 [counter-basic](examples/counter-basic/) - A basic event sourced counter with a command API to increment & decrement counters, and a query API that answers queries inefficiently by replaying a counter's entire event history.
1. 😊 [counter-cqrs](examples/counter-cqrs/) - builds on counter-basic by adding a separate, optimized read model and a new query API that answers queries using the read model.
1. 😁 [counter-optimistic-concurrency](examples/counter-optimistic-concurrency/) - builds on counter-cqrs by adding a new command handler that uses optimistic concurrency control to ensure counter events are only appended when their history hasn't changed.
1. 🥳 [counter-snapshot](examples/counter-snapshot/) - builds on counter-optimistic-concurrency by adding a new command handler that uses snapshots to update a counter without needing to read 
its entire history.

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

## Types & API

### Pending

```ts
export type Pending<D> = {
  readonly type: string
  readonly correlationId?: string
  readonly data: D
}
```

The Pending type represents an event that has been created but not yet committed to the event store.

* `type`: The type of the event.
* `correlationId` (optional): A unique identifier for correlating events.
* `data`: The event data.

### Committed

```ts
export type Committed<D> = Pending<D> & {
  readonly key: string
  readonly position: Position
  readonly committedAt: string
}
```

The Committed type extends Pending by adding information about the event’s position, key, slice, and the timestamp when it was committed to the event store.

* `key`: The unique identifier for the event in the event store.
* `position`: The position of the event within the store.
* `committedAt`: The timestamp when the event was committed.

### Position

```ts
export type Position = string & { readonly type: 'Position' }
```

The Position type uniquely identifies the position of an event within the event store. It is used to track the order of events and ensure consistency in event handling.

It's used in various parts of the event store API, such as the RangeInput, Pending, and Committed types, and functions like read, readAll, and append.

### RangeInput

```ts
export type RangeInput = {
  readonly start?: Position
  readonly startExclusive?: boolean
  readonly end?: Position
  readonly endExclusive?: boolean
  readonly limit?: number
  readonly direction?: 'forward' | 'backward'
}
```

The RangeInput type defines the range for reading events in the event store, with optional start and end positions, exclusivity flags, and a limit on the number of events.

* `start` (optional): Position to start reading from.
* `startExclusive` (optional): If true, excludes the start position.
* `end` (optional): Position to stop reading at.
* `endExclusive` (optional): If true, excludes the end position.
* `limit` (optional): Maximum number of events to retrieve.
* `direction` (optional, default 'forward'): If 'forward', reads events in chronological order.  If 'backward', reads events in _reverse_ chronological order.

## API

### fromConfig

```ts
fromConfig(config: EventStoreConfig, client: DynamoDBClient, nextPosition?: (epochMilliseconds?: number) => Position): EventStoreClient
```

Creates an EventStoreClient instance from a configuration object, a DynamoDB client, and an optional position generator function.

```ts
const config: EventStoreConfig = {
  name: "myEventStore",
  eventsTable: "EventsTable",
  metadataTable: "MetadataTable",
  byKeyPositionIndexName: "ByKeyPositionIndex"
};

const client = new DynamoDBClient({});
const eventStoreClient = fromConfig(config, client);
```

### append

```ts
append<D extends NativeAttributeValue>(es: EventStoreClient, key: string, events: readonly Pending<D>[], options?: AppendKeyOptions): Promise<AppendResult>
```

Appends events to the event store for a specific key. Optionally supports idempotency and optimistic concurrency.

```ts
const result = await append(eventStoreClient, "user123", [{ type: "Created", data: { userId: "user123" } }]);
console.log(result);
```


### read

```ts
read<A>(es: EventStoreClient, key: string, r: RangeInput = {}): AsyncIterable<Committed<A>>
```

Reads a range of events for a specific key. The range is inclusive and can be specified using a RangeInput. Omitting the range reads all events for the key.

```ts
for await (const event of read(eventStoreClient, "user123", { start: "100", end: "200" })) {
  console.log(event);
}
```

### readForAppend

```ts
readForAppend<A>(es: EventStoreClient, key: string, r: RangeInput = {}): Promise<readonly [Position | undefined, AsyncIterable<Committed<A>>]>
```

Reads events for a specific key, starting from the most recent event’s position. Useful for appending new events with optimistic concurrency.

```ts
const [lastPosition, events] = await readForAppend(eventStoreClient, "user123");
for await (const event of events) {
  console.log(event);
}
```

### readLatest

```ts
readLatest<A>(es: EventStoreClient, key: string): Promise<Committed<A> | undefined>
```

Reads the most recent event for a specific key. Useful to retrieve the latest event or position for a given key.

```ts
const latestEvent = await readLatest(eventStoreClient, "user123");
console.log(latestEvent);
```

### readAll

```ts
readAll<A>(es: EventStoreClient, r: RangeInput = {}): AsyncIterable<Committed<A>>
```

Reads a range of all events from the event store. The range is inclusive and can be specified using a RangeInput. If omitted, it will read all events.

```ts
for await (const event of readAll(eventStoreClient)) {
  console.log(event);
}
```

## Resources & Inspirations

* [Greg Young - Event Sourcing - GOTO 2014](https://youtu.be/8JKjvY4etTY?si=wAnuTauSWKitKhWe)
* [In-Depth Look at Event Sourcing with CQRS Architecture & Design • Sebastian von Conrad • YOW! 2017](https://youtu.be/8eNhJPjZSsY?si=N__A8_BORbzCCoXc)
* [Kurrent](kurrent.io) - Event-native platform for event sourcing