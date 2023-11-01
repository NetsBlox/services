const Messages = {};

class Message {
  constructor(target, msgType, content) {
    this.target = target;
    this.content = {
      type: "message",
      msgType,
      content,
    };
  }
}

class SendMessage extends Message {
  constructor(address, type, contents) {
    const target = { address: { address } };
    super(target, type, contents);
  }
}

class SendMessageToClient extends Message {
  constructor(state, clientId, type, contents) {
    const target = { client: { state, clientId } };
    super(target, type, contents);
  }
}

class SendMessageToRoom extends Message {
  constructor(projectId, type, contents) {
    const target = { room: { projectId } };
    super(target, type, contents);
  }
}

class SendMessageToRole extends Message {
  constructor(projectId, roleId, type, contents) {
    const target = { role: { projectId, roleId } };
    super(target, type, contents);
  }
}

Messages.parse = Message.parse;
Messages.SendMessage = SendMessage;
Messages.SendMessageToClient = SendMessageToClient;
Messages.SendMessageToRoom = SendMessageToRoom;
Messages.SendMessageToRole = SendMessageToRole;
module.exports = Messages;
