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

    const useProducer = async (queueName, { prefetch, index, fanout }) => {
        const queueInstance = {
            queue: queueName,  // Declare the type of queue

            // Submit a job to the current queue
            submit: async (job) => {
                if (!queueInstance.queue) throw new Error('Queue is not created yet.');
                return submitJob(queueInstance, job);
            },
        };

        try {
            await fetch(`${httpUrl}/config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    queue: queueName,
                    prefetch,
                    index,
                    fanout
                })
            });
        } catch (err) {
            console.error(err);
        }

        // Periodically flush the batch if it's not full, based on the flush interval
        setInterval(() => {
            if (jobBatch.length > 0) {
                submitJobBatch(queueInstance)
            }
        }, flushInterval)

        return queueInstance;
    };


    const useConsumer = (queueName) => {
        const queueInstance = {
            queue: null,  // Declare the type of queue
            socket: undefined,  // Declare the type of socket
            // Acknowledge a job for this specific queue instance
        };

        queueInstance.queue = queueName;
        queueInstance.socket = new WebSocket(wsUrl);

        queueInstance.socket.on('open', () => {
            queueInstance.socket?.send(JSON.stringify({ type: 'subscribe', queue: queueInstance.queue }));
        });

        queueInstance.socket.ack = (jobId) => {
            if (!queueInstance.socket || queueInstance.socket.readyState !== WebSocket.OPEN) {
                throw new Error('Socket is not connected.');
            }

            queueInstance.socket.send(JSON.stringify({
                type: 'ack',
                queue: queueInstance.queue,
                jobId
            }));
        }

        return queueInstance.socket;
    }

    return {
        useProducer,
        useConsumer
    }
}