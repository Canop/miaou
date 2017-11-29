miaou(function(broadcast, fmt, locals, md, plugins, ws){

	function show(bm){
		md.notificationMessage(function($c){
			$("<div>").html(fmt.mdTextToHtml(bm.content)).appendTo($c);
		});
	}

	function renderMessage($c, m){
		if (m.author!==locals.me.id || !/^!!broadcast/.test(m.content)) return;
		var b = new broadcast.Broadcast(m.content);
		if (!b.isValid()) return;
		var editable = b.status === "draft";
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
			if (!editable) $cb.prop("disabled", true);
			langCheckBoxes.push($cb[0]);
			$("<label>").text(lang.lang).prepend($cb).appendTo($div);
		});

		// content
		$div = $("<div>").addClass("broadcast-content").appendTo($c);
		$("<span>").text("Content:").appendTo($div);
		var $content = $("<textarea>").val(b.content).appendTo($div);
		if (!editable) $content.prop("disabled", true);

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
		if (m.author===locals.me.id) {
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
		}
		return true; // meaning no other renderer should follow
	}

	plugins.add("broadcast", {
		start: function(){
			ws.on('broadcast.show', show);
			md.registerRenderer(renderMessage);
		}
	});

});
