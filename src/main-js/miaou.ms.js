// "ms" : message status
//
// the status of a message is changed/checked on some events
//  like menu displaying
// It's an object attached to the message and containing the
//  following properties :
//  - old         : boolean
//  - editable    : boolean
//  - deletable   : boolean
//  - answerable  : boolean
//  - continuable : boolean

miaou(function(ms, chat, locals, time, usr){

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
			status.continuable = status.answerable = status.deletable = status.editable = false;
			return;
		}
		var	created = time.local(message.created),
			deleted = !message.content,
			modDeleted = /^!!deleted/.test(message.content);
		status.answerable = !deleted && message.author!==locals.me.id;
		status.continuable = !deleted && message.author===locals.me.id;
		status.old =  time.now() - created > chat.config.maxAgeForMessageEdition;
		status.deletable = status.editable =
			!deleted
			&& message.author===locals.me.id
			&& !status.old
			&& message.content
			&& !modDeleted;
		status.mod_deletable = !deleted && usr.checkAuth('admin') && message.content && !modDeleted;
	});

	ms.updateStatus = function(message){
		if (!message.status) message.status = {};
		statusModifiers.forEach(function(fun){
			fun(message, message.status);
		});
	}

});
