Configuring Services
====================

Some of the NetsBlox services, such as :doc:`/services/GoogleMaps/index`, require a default API key to be provided on the deployment to be available.
Requests to these services will then use the default API key if the user does not have any API keys defined for him/herself or for the group/class.

If you don't mind viewing the source code, the keys (and links to set up an API key) can be found `here <https://github.com/NetsBlox/NetsBlox/blob/master/src/server/services/procedures/utils/api-key.js#L22-L75>`__.
All API keys can be set by setting the corresponding environment variable.
The environment variable is either generated automatically by converting the name to all caps and replacing spaces with underscores (eg, ``Google Maps -> GOOGLE_MAPS_KEY``) or is is listed in the referenced code snippet as the third value passed to ``ApiKey``.
For example, ``The Movie Database`` is set using ``TMDB_API_KEY``.

Required Environment Variables for Services
-------------------------------------------

.. list-table::
    :header-rows: 1

    * - Service
      - Environment Variable
      - Provider
<% for (const serviceName of Object.keys(apiKeys).filter(s => apiKeys[s]).sort()) { %>
<% const key = apiKeys[serviceName]; %>
    * - :doc:`/services/<%= serviceName %>/index`
      - ``<%= key.envVar %>``
      - `<%= key.provider %> <<%= key.helpUrl %>>`__
<% } %>

Services Requiring Additional Configuration
-------------------------------------------

Alexa Service
^^^^^^^^^^^^^

There are a few steps to enable the Alexa service on a custom NetsBlox deployment. They are outlined here:

1. Register "Amazon Alexa" as an OAuth client using the NetsBlox CLI
2. Generate LWA Keys (instructions `here <https://www.npmjs.com/package/ask-smapi-sdk>`__)
3. Set the environment variables using the values from the above steps:

   1. Set the client ID and secret from the first step as `OAUTH_CLIENT_ID` and `OAUTH_CLIENT_SECRET`
   2. Set the client ID and secret from the second step as `LWA_CLIENT_ID` and `LWA_CLIENT_SECRET`

4. Confirm that the standard configuration environment variables are correctly set including:

   1. `NETSBLOX_CLOUD` should be set to the publicly accessible URL for the NetsBlox cloud
   2. `NETSBLOX_CLOUD_ID` should be set to the ID used when registering the services server with the NetsBlox cloud
   3. `NETSBLOX_CLOUD_SECRET` should be set to the secret returned when registering the services server with the NetsBlox cloud
   4. `SERVER_URL` should be set to the publicly accessible URL for the services server such as http://services.netsblox.org
