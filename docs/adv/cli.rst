Command Line Interface
======================

The `NetsBlox CLI <https://github.com/NetsBlox/cloud/releases>`__ can be used to manage your NetsBlox account and/or deployment.
This page is a short primer on getting started with the CLI.

Getting Started
---------------
The CLI has fairly comprehensive coverage of the cloud API. The easiest way to learn more about the CLI is to simply type partial commands and use the "--help" flag :) . A few examples are shown below.

.. code-block:: sh

    netsblox # prints the supported subcommands including groups, friends, libraries, etc
    netsblox users # prints the subcommands pertaining to user-management
    netsblox users set-password -h # prints info about setting the current user's password.

The CLI is designed to be "current user-centric". Every command will assume it should be run in the context of the current authenticated user. For example, listing projects will list the current user's projects. To perform a command in the context of another user, add the "--user" flag as shown below.

.. code-block:: sh

    netsblox projects list --user brian


Example Usage: Setting up a Summer Camp/Course
----------------------------------------------
First, you likely want to create a group for the students as shown below.

.. code-block:: sh

    netsblox groups create MyFirstGroup

Now we should be able to confirm the group was created successfully with:

.. code-block:: sh

    netsblox groups list

There are a few benefits to setting up user accounts in a group:
- Group owners can manage member accounts. This includes viewing projects, resetting passwords, importing starter projects, etc.
- It creates a "sandbox" for users. Students can only message others within the group.

After creating the group, we can start adding user accounts to group:

.. code-block:: sh

    netsblox users create SOME_STUDENT_USERNAME EMAIL_ADDRESS -g MyFirstGroup -p SOME_PASSWORD

We can run this command for each student we would like to add. If you are comfortable with bash scripts or batch files, these commands can be listed in a file which runs them all at once and creates the accounts quickly. Regardless, we can confirm the members have been created with:

.. code-block:: sh

    netsblox groups members MyFirstGroup

Downloading Student Projects
----------------------------
If we know the name of a project for a student that we would like to retrieve, we can download it locally using:

.. code-block:: sh

    netsblox projects export PROJECT_NAME --user SOME_STUDENT_USERNAME

Adding Starter Projects
-----------------------
We also might want to set the accounts up with some starter projects. The following command will import a local project file to a student account:

.. code-block:: sh

    netsblox projects import FILENAME --user SOME_STUDENT_USERNAME

Resetting Passwords
-------------------
We can reset our password, or the password of a member of one of our groups, with:

.. code-block:: sh

    netsblox users set-password NEW_PASSWORD --user SOME_STUDENT_USERNAME

Omitting the "--user" option will reset your own password.
