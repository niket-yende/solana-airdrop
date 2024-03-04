class AsyncQueue {
    constructor(name) {
      this.name = name;  
      this.queue = [];
      this.running = false;
    }

    enqueue(task) {
      const promise = new Promise((resolve, reject) => {
        this.queue.push({ task, resolve, reject }); // Push the task along with resolve and reject functions into the queue
        if (!this.running) {
          this.processQueue();
        }
      });
      return promise;
    }
  
    async processQueue() {
      if (this.running || this.queue.length === 0) {
        return;
      }
  
      this.running = true;
      const { task, resolve, reject } = this.queue.shift();
      try {
        const result = await task();
        resolve(result); // Resolve the promise returned by enqueue with the result of the task
      } catch (error) {
        console.error('Error processing task:', error);
        reject(error); // Reject the promise returned by enqueue with the error
      } finally {
        this.running = false;
        this.processQueue();
      }
    }
  }
  
  // Queues correspoinding to offline servers
  const asyncQueue1 = new AsyncQueue('server1');
  const asyncQueue2 = new AsyncQueue('server2');
  const asyncQueue3 = new AsyncQueue('server3');
  
  function asyncTask(data, server) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        console.log(`Processing address: ${data}, server: ${server}`);
        const response = 'wallet-'+data;
        resolve(response);
      }, 1000);
    });
  }

const servers = ['server1', 'server2', 'server3'];

function shuffle(arr) {
    const server = arr[(Math.floor(Math.random() * arr.length))];
    return server;
}

async function processTasks() {
  const promises = [];
  // Generate 9 addresses
  for (let index = 1; index <= 9; index++) {
      const selectedServer = shuffle(servers);
      switch (selectedServer) {
          case servers[0]:
              const promise1 = asyncQueue1.enqueue(() => asyncTask(index, asyncQueue1.name));
              promises.push(promise1);
              break;
          case servers[1]:
              const promise2 = asyncQueue2.enqueue(() => asyncTask(index, asyncQueue2.name));
              promises.push(promise2);
              break;
          case servers[2]:
              const promise3 = asyncQueue3.enqueue(() => asyncTask(index, asyncQueue3.name));
              promises.push(promise3);
              break;
          default:
              console.log('Invalid server');
              break;
      }
  }

  
  // Wait for all promises to settle
  const wallets = await Promise.allSettled(promises)
      .then(results => {
        const resultArray = [];
          results.forEach((result, index) => {
            console.log(result);
            if (result.status === 'fulfilled') {
              console.log(`Task ${index + 1} succeeded.`);
              resultArray.push(result.value);
            } else if (result.status === 'rejected') {
                console.error(`Task ${index + 1} failed:`, result.reason);
            }
          });
          return resultArray;
      });

      console.log(wallets);
}

processTasks();