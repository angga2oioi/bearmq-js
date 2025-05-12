//@ts-check
const WebSocket = require("ws")
const BATCH_SIZE = 500;  // Number of jobs per batch
const FLUSH_INTERVAL = 100;  // Timeout in ms to flush the current batch if it hasn't reached BATCH_SIZE

exports.useMQ = (domain) => {
    let httpUrl = `http://${domain}`
    let wsUrl = `ws://${domain}`

    const useProducer = (queueName, { prefetch, index, fanout }) => {
        const queueInstance = {
            queue: null,
            bufferedJobs: [], // Buffer to hold jobs for batching
            flushTimeout: null, // Timeout for auto-flushing jobs
            lastSubmitTime: 0, // Track last submit time for flushing
        };

        // Submit a job to the current queue
        const submit = async (job) => {
            if (!queueInstance.queue) throw new Error('Queue is not created yet.');

            // Buffer the job
            queueInstance.bufferedJobs.push(job);

            // If the batch size is reached, submit the jobs
            if (queueInstance.bufferedJobs.length >= BATCH_SIZE) {
                await submitBatch(queueInstance.bufferedJobs);
                queueInstance.bufferedJobs = []; // Reset buffer after submit
            }

            // Schedule flush if time interval exceeds FLUSH_INTERVAL
            if (Date.now() - queueInstance.lastSubmitTime > FLUSH_INTERVAL) {
                clearTimeout(queueInstance.flushTimeout);
                queueInstance.flushTimeout = setTimeout(async () => {
                    if (queueInstance.bufferedJobs.length > 0) {
                        await submitBatch(queueInstance.bufferedJobs);
                        queueInstance.bufferedJobs = []; // Reset buffer after submit
                    }
                }, FLUSH_INTERVAL);
            }

            queueInstance.lastSubmitTime = Date.now();
        };

        // Submit a batch of jobs to the server
        const submitBatch = async (batch) => {
            await fetch(`${httpUrl}/enqueue`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ queue: queueInstance.queue, jobs: batch }),
            });
        };

        queueInstance.queue = queueName;
        fetch(`${httpUrl}/config`, {
            method: 'POST',
            body: JSON.stringify({
                queue: queueName,
                prefetch,
                index,
                fanout
            })
        }).catch(console.error);

        return {
            submit,
        };
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