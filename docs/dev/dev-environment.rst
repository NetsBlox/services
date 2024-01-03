Development Environment
=======================

NetsBlox is composed of a number of modular components providing different functionality. These include:
- `cloud <https://github.com/netsblox/cloud>`_: management of user accounts, projects, libraries, authentication, etc. Persists project data in S3; everything else is in MongoDB
- `browser <https://github.com/netsblox/Snap--Build-Your-Own-Blocks>`_: hosts the browser environment.
- `services <https://github.com/netsblox/services>`_: provides services accessible via the "call <RPC>" block. Persists data, such as cloud variables, in MongoDB.

- `login server <https://github.com/netsblox/login-server>`_: An optional server providing a login page complete with redirection (customizable via URL parameters)

When developing a specific component, it can usually be run by itself and simply use the production deployment for the remaining functionality. Recommendations for development of specific components is given below.

Browser
-------

Browser development is perhaps the easiest. Simply setup the browser following the `readme <https://github.com/netsblox/snap--Build-Your-Own-Blocks/>`_ and it will use the production backend services by default.

Services
--------

As before, first setup a local instance of the services following the `readme <https://github.com/netsblox/services/>`_. Once you are ready to start the server, set the following environment variables to configure it to use the production cloud server.

.. code-block:: sh

    NETSBLOX_CLOUD=https://cloud.netsblox.org NETSBLOX_CLOUD_ID=LocalServices NETSBLOX_CLOUD_SECRET=SuperSecret npm start

Next, use the `NetsBlox CLI <https://github.com/NetsBlox/cloud/releases>`_ to register the services host with your NetsBlox username as follows:

.. code-block:: sh

	netsblox service-hosts register http://localhost:8080 LocalServices

The above command will register the local server with the production cloud for your account. The "call <RPC>" block will now show the local services under a "LocalServices" submenu.

When you are done working on the services server, unregister the services host with:

.. code-block:: sh

	netsblox service-hosts unregister http://localhost:8080

If the local services server is stopped (but not unregistered) there will be a warning displayed when https://editor.netsblox.org is loaded stating that the services host is not available.

Cloud
-----

First, follow the quick start in `readme from the GitHub repository <https://github.com/netsblox/cloud>`_. This will require a local instance of MongoDB and S3 provider (like Minio).

Next, the production deployment of the NetsBlox IDE can be configured to use this local cloud using the following link: `https://editor.netsblox.org?cloud=http://localhost:7777 <https://editor.netsblox.org?cloud=http://localhost:7777>`_

Login Server
------------

Developing the login server is similar to the browser. Simply follow the `readme <https://github.com/netsblox/login-server/>`_ and it will connect to the production environment by default.

