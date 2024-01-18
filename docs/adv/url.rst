Sharing Projects via URLs
=========================

When opening NetsBlox, there are a number of URL parameters that can be used to modify the behavior when it opens. This includes things like opening a public project or setting the language. Although NetsBlox supports configuration using hash parameters in the URL (i.e., adding text after a "#" in the URL), the recommended approach is to use query string parameters instead (i.e., text after a "?" in the URL).

Actions
-------
The most common use of custom URLs in NetsBlox is for sharing public projects or automatically opening example projects. This is supported through setting the "action" parameter. Below is a list of supported actions.

*open*
	Immediately open a project or block library. Expects a single parameter, *data*, set to the URL or XML string of the project or library to import.

	- Parameters:
		- *data*: the project or block library to open. It can be specified as a URL or as a (URI encoded) XML string. **required**
*run*
	Open a project and run it.

	- Parameters:
		- *data*: the project or block library to open. It can be specified as a URL or as a (URI encoded) XML string. **required**
		- *editMode*: If set, the project will be open in a regular mode. Otherwise, it will be opened in "app mode" (see the **appMode** setting).
		- *noRun*: This action will run the project on open (see the **run** setting). Adding this parameter to the URL will revert this behavior so the project will not run on start.
*present*
	Open a copy of the given public project and run it.

	- Parameters:
		- *Username*: The owner of the public project to open **required**
		- *ProjectName*: The name of the public project to open **required**
		- *editMode*: If set, the project will be open in a regular mode. Otherwise, it will be opened in "app mode" (see the **appMode** setting).
		- *noRun*: This action will run the project on open (see the **run** setting). Adding this parameter to the URL will revert this behavior so the project will not run on start.
*example*
	Open a project from the list of official NetsBlox examples and run it.

	- Parameters:
		- *ProjectName*: The name of the example project to open **required**
		- *editMode*: If set, the project will be open in a regular mode. Otherwise, it will be opened in "app mode" (see the **appMode** setting).
		- *noRun*: This action will run the project on open (see the **run** setting). Adding this parameter to the URL will revert this behavior so the project will not run on start.
*private*
	Open a project owned by the logged in user and run it.

	- Parameters:
		- *ProjectName*: The name of the example project to open **required**
		- *editMode*: If set, the project will be open in a regular mode. Otherwise, it will be opened in "app mode" (see the **appMode** setting).
		- *noRun*: This action will run the project on open (see the **run** setting). Adding this parameter to the URL will revert this behavior so the project will not run on start.
*dl*
	Download a public project.

	- Parameters:
		- *Username*: The owner of the public project to open **required**
		- *ProjectName*: The name of the public project to open **required**
*signup*
	Open the signup dialog on start.

Other Settings
--------------
The following settings are generally available, regardless of the action:

- **appMode**: Start NetsBlox in fullscreen mode. Some actions, such as "present", will set this to true unless explicitly overridden.
- **embedMode**: Open NetsBlox and customize the UI for embedding in a bigger site like on the social project sharing/commenting sites by Snap or Scratch. Expected to be used with **appMode**.
- **run**: Trigger the green flag as soon as NetsBlox starts.
- **hideControls**: Hide the control bar (with the green flag, red stop sign, etc).
- **noExitWarning**: Don't confirm that the user wants to leave the page on tab close.
- **lang**: Set the language immediately. For example, "lang=hu" will set NetsBlox to Hungarian on start.
- **setVariable**: Set a variable to the given value on start. The value is expected to be a URL-encoded pair so setting "hello" to "world" would be "hello%3Dworld".
