Configuring the Alexa Service
=============================

There are a few steps to enable the Alexa service on a custom NetsBlox deployment. They are outlined here:

1. Register "Amazon Alexa" as an OAuth client using the NetsBlox CLI
2. Generate LWA Keys (instructions `here <https://www.npmjs.com/package/ask-smapi-sdk>`_)
3. Set the environment variables using the values from the above steps:

   1. Set the client ID and secret from the first step as `OAUTH_CLIENT_ID` and `OAUTH_CLIENT_SECRET`
   2. Set the client ID and secret from the second step as `LWA_CLIENT_ID` and `LWA_CLIENT_SECRET`

4. Confirm that the standard configuration environment variables are correctly set including:

   1. `NETSBLOX_CLOUD` should be set to the publicly accessible URL for the NetsBlox cloud
   2. `NETSBLOX_CLOUD_ID` should be set to the ID used when registering the services server with the NetsBlox cloud
   3. `NETSBLOX_CLOUD_SECRET` should be set to the secret returned when registering the services server with the NetsBlox cloud
   3. `SERVER_URL` should be set to the publicly accessible URL for the services server such as http://services.netsblox.org
