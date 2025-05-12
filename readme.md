# bearMQ-js

`bearMQ-js` is a simple JavaScript library that provides a message queue interface to [bearMQ](https://github.com/angga2oioi/bearMQ) project. It allows for both producing and consuming messages from a specified queue, facilitating communication and job processing in a modular way.

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
- [License](#license)

## Installation

To install the library, clone this repository and run `npm install`:

```bash
npm i github:angga2oioi/bearmq-js#release
```

## Usage

To use the library, first import the `useMQ` function from `index.js` and initialize it with your domain.

### Example

```javascript
const { useMQ } = require("bearmq-js");

// Initialize the message queue with domain
const mq = useMQ('ip:port');

// Create a producer
const producer = mq.useProducer('yourQueueName', {
    prefetch: 10,
    index: [],
    fanout: false
});

// Submit a job to the queue
producer.submit({ jobData: 'Your job data here' })
    .then(() => console.log('Job submitted'))
    .catch(console.error);

// Create a consumer
const consumer = mq.useConsumer('yourQueueName');

consumer.on('message', (msg) => {
  const {data,jobId} = msg
    console.log('Received message:', msg);
    
    // Always acknowledge the message
    consumer.ack(jobId)
});

```


## License

This project is licensed under the ISC License.