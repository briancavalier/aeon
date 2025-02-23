# Event Soucing DIY

The ice cream truck example from [The Dev Owl](https://www.youtube.com/@TheDevOwl)'s [Event Sourcing DIY Youtube series](https://www.youtube.com/watch?v=zyp9pZ7jeK8&list=PL-nSd-yeckKh7Ts5EKChek7iXcgyUGDHa).

The version implemented here is the one that the series ends up with in episide 06, plus the queries from the [How to write a Query Handler Part 2](https://youtu.be/przz3vuAf_M?si=hSQF73OK1Yag2uxJ) episode.

However, this example implements some details of the command and query handlers in a style that aligns with Aeon's goals and API.  It also makes use of features like optimistic concurrency that were outside the scope of the Youtube series.

I tried to reproduce the domain as presented in the series as closely as possible in TypeScript.
