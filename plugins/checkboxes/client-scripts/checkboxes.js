// Note: there may be errors (wrong checkboxes checked) when a message
//  contains both right checkboxes and wrong ones (ones in code for example).
miaou(function(md, chat, ms, plugins){

	function render($c, m){
		ms.updateStatus(m);
		if (!m.status.editable) return;
		var i = 0;
		Groumf.replaceTextWithHTMLInHTML($c[0], /[☐☑]/g, function(s){
			var html =  "<input type=checkbox class=cb-cb cb-index="+(i++);
			if (s==="☑") html += " checked";
			html += ">";
			return html;
		});
	}

	plugins.checkboxes = {
		start: function(){
			md.registerRenderer(render, true);
		}
	}

	$("#messages, #notable-messages, #search-results").on("change", ".cb-cb", function(e){
		console.log("click cb-cb", $(this).attr("cb-index"));
		var	message = $(this).closest(".message").dat("message"),
			cbIndex = +this.getAttribute("cb-index"),
			cbValue = !!this.checked,
			i = 0;
		chat.sendMessage({
			id: message.id,
			content: message.content.replace(/\[[ x]\]/ig, function(s){
				return i++===cbIndex ? (cbValue ? "[x]" : "[ ]") : s;
			})
		});

	});

});

