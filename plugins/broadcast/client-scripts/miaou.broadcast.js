miaou(function(broadcast, fmt, links, locals, md, ms, plugins, ws){

	function show(bm){
		console.log('bm:', bm);
		md.notificationMessage(function($c){
			var md = "*@"+bm.author.name+
				" broadcasts from room ["+bm.room.name+"]("+bm.room.id+"#"+bm.mid+"):*\n"+
				bm.content;
			var $div = $("<div>").html(fmt.mdTextToHtml(md));
			links.transformLinksToMiaou($div);
			$div.appendTo($c);
		});
	}

	function renderMessage($c, m){
		if (m.author!==locals.me.id || !/^!!broadcast/.test(m.content)) return;
		var b = new broadcast.Broadcast(m.content);
		if (!b.isValid()) return;
		if (b.status !== "draft") return;
		$c.empty().addClass("broadcast-editor");

		// title
		$("<span class=h1>").text("Broadcast:").appendTo($c);

		// tags
		$div = $("<div>").addClass("broadcast-tags").appendTo($c);
		$("<span>").text("Tags:").appendTo($div);
		var $tags = $("<input>").val(b.tags.join(" ")).show().appendTo($div);
		$tags.editTagSet();

		// langs
		var $div = $("<div>").addClass("broadcast-langs").append("<span>Languages:</span>").appendTo($c);
		var langCheckBoxes = [];
		b.langs.forEach(function(lang){
			var $cb = $("<input type=checkbox>").prop("checked", lang.on);
			langCheckBoxes.push($cb[0]);
			$("<label>").text(lang.lang).prepend($cb).appendTo($div);
		});

		// content
		$div = $("<div>").addClass("broadcast-content").appendTo($c);
		$("<span>").text("Content:").appendTo($div);
		var $content = $("<textarea>").val(b.content).appendTo($div);

		// status
		if (b.status==="draft") {
			$("<i>").text("The message hasn't been broadcasted yet.").appendTo($c);
		}

		// buttons
		function update(){
			b.content = $content.val();
			b.langs.forEach(function(lang, i){
				lang.on = langCheckBoxes[i].checked;
			});
			b.tags = $tags.val().split(" ").filter(Boolean);
		}
		var $div = $("<div>").addClass("broadcast-buttons").appendTo($c);
		var addButton = function(name, status){
			var but = document.createElement("button");
			but.textContent = name;
			but.onclick = function(){
				update();
				if (status) b.status = status;
				m.content = b.md();
				ws.emit("message", m);
			};
			$div.append(but);
		}
		if (b.status==="draft") {
			addButton("save");
			addButton("send", "sending");
		}
		return true; // meaning no other renderer should follow
	}

	plugins.add("broadcast", {
		start: function(){
			ws.on('broadcast.show', show);
			ms.registerStatusModifier(function(message, status){
				if (/^!!broadcast/.test(message.content)) {
					status.editable = false;
					status.deletable = false;
				}
			});
			md.registerRenderer(renderMessage);
		}
	});

});
