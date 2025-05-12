//@ts-check
const WebSocket = require("ws")
exports.useMQ = (domain) => {
    let httpUrl = `http://${domain}`
    let wsUrl = `ws://${domain}`

    const useProducer = (queueName, { prefetch, index, fanout }) => {

        const queueInstance = {
            queue: null,  // Declare the type of queue

            // Submit a job to the current queue
            submit: async (job) => {
                if (!queueInstance.queue) throw new Error('Queue is not created yet.');
                await fetch(`${httpUrl}/enqueue`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ queue: queueInstance.queue, job })
                });
            },

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
        }).catch(console.error)


        return queueInstance;
    }

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