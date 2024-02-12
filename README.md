# NetsBlox Services

Services are collections of RPCs available to the NetsBlox clients. These can
serve a number of different functions including:

- accessing to existing web APIs
- accessing real world datasets
- facilitating development of challenging multiplayer games

For more information, check out the
[wiki page](https://github.com/NetsBlox/NetsBlox/wiki/Services-Overview).

# Development

The easiest way to develop services is to run (only) the services server locally and connect to it via the official browser deployment at editor.netsblox.org.
To do this, you will need to be logged in and use the NetsBlox CLI to add local services to your account.

If you have not already done so, install the NetsBlox CLI via

```bash
cargo install netsblox-cli
```

Next, add local services to your account.
```bash
netsblox service-hosts register http://localhost:8080 LocalServices -u <username>
```

Then run local services and do any development you need.
```bash
PORT=8080 NETSBLOX_CLOUD=https://cloud.netsblox.org NETSBLOX_CLOUD_ID=LocalServices NETSBLOX_CLOUD_SECRET=SuperSecret npm start
```

And finally, remove local services from your account.
This is an optional step; not doing this will only result in a warning message every time you load the editor while local services are not running.
```bash
netsblox service-hosts unregister http://localhost:8080 -u <username>
```
