// "ms" : message status
//
// the status of a message is changed/checked on some events
//  like menu displaying
// It's an object attached to the message and containing the
//  following properties :
//  - old         : boolean
//  - editable    : boolean
//  - deletable   : boolean

miaou(function(ms, usr){

	// functions building the status which is needed on some actions
	//   like menu display
	var statusModifiers = [];

	// registers a status modifier. This function can directly change
	//   message.status where message is the argument they get
	// Note that messages without id should never be
	//   editable, answerable or deletable.
	ms.registerStatusModifier = function(fun){
		statusModifiers.push(fun);
	}

	ms.registerStatusModifier(function(message, status){
		if (!message.id) {
			status.answerable = status.deletable = status.editable = false;
			return;
		}
		var created = message.created+miaou.chat.timeOffset;
		status.answerable = message.author !== me.id;
		status.old =  Date.now()/1000 - created > miaou.chat.MAX_AGE_FOR_EDIT;
		status.deletable = status.editable = message.author===me.id && !status.old && message.content;
		status.mod_deletable = usr.checkAuth('admin') && message.content;
	});

	ms.updateStatus = function(message){
		if (!message.status) message.status = {};
		statusModifiers.forEach(function(fun){
			fun(message, message.status);
		});
	}

});
