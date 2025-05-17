//@ts-check
const WebSocket = require("ws")
exports.useMQ = (domain) => {
    let httpUrl = `http://${domain}`
    let wsUrl = `ws://${domain}`

    let flushInterval = 1;  // Start with 1 ms

    // Batching settings
    const BATCH_SIZE = 500;
    let jobBatch = [];  // Array to collect jobs for batch submission

    // Function to submit batch of jobs
    const submitJobBatch = async (queueInstance) => {
        let res
        if (jobBatch.length > 0) {
            res = fetch(`${httpUrl}/enqueue`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    queue: queueInstance.queue,
                    jobs: jobBatch
                })
            })

            jobBatch = [];  // Clear the batch after submission

        }

        return res
    };

    // Automatically adjust the interval and submit jobs in batches
    const submitJob = (queueInstance, job) => {
        jobBatch.push(job);  // Add job to the batch

        if (jobBatch.length >= BATCH_SIZE) {
            return submitJobBatch(queueInstance);
        }
        return null
    };

    const useProducer = (queueName, options) => {
        const queueInstance = {
            queue: queueName,  // Declare the type of queue

            // Submit a job to the current queue
            submit: async (job) => {
                if (!queueInstance.queue) throw new Error('Queue is not created yet.');
                return submitJob(queueInstance, job);
            },
        };

        fetch(`${httpUrl}/config`, {
            method: 'POST',
            body: JSON.stringify({
                queue: queueName,
                index: options?.index ?? [],
                fanout: options?.fanout ?? false
            })
        }).catch(console.error);

        // Periodically flush the batch if it's not full, based on the flush interval
        setInterval(() => {
            if (jobBatch.length > 0) {
                submitJobBatch(queueInstance)
            }
        }, flushInterval)

        return queueInstance;
    };

    const useConsumer = (queueName, prefetch = null) => {
        const EventEmitter = require('node:events');
        const emitter = new EventEmitter();

        const socket = new WebSocket(wsUrl);

        emitter.ack = (jobId) => {
            if (!socket || socket.readyState !== WebSocket.OPEN) {
                throw new Error('Socket is not connected.');
            }

            socket.send(JSON.stringify({
                type: 'ack',
                queue: queueName,
                jobId
            }));
        }

        socket.addEventListener('open', event => {
            socket?.send(JSON.stringify({ type: 'subscribe', queue: queueName, prefetch }));
        });

        // Listen for messages and executes when a message is received from the server.
        socket.addEventListener('message', event => {
            const { data, type } = JSON.parse(event.data)
            if (data.length < 1) {
                return
            }
            data.forEach(item => {
                emitter.emit("message", JSON.stringify({ ...item, type }))
            });

        });

        socket.addEventListener('close', event => {
            console.log('WebSocket connection closed:', event.code, event.reason);
            emitter.emit("close", event)
        });
        // Executes if an error occurs during the WebSocket communication.
        socket.addEventListener('error', error => {
            console.error('WebSocket error:', error);
            emitter.emit("error", error)
        });

        emitter.close = () => socket.close()

        return emitter
    }

    return {
        useProducer,
        useConsumer
    }
}