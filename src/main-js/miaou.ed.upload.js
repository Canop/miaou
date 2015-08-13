// ed is the message editor, managing the user input
// ed.upload handles image upload

miaou(function(ed){
		
	function uploadFile(file){
		var fd = new FormData(); // todo: do I really need a formdata ?
		fd.append("file", file);
		var xhr = new XMLHttpRequest();
		xhr.open("POST", "upload");
		function finish(){
			$('#upload-controls,#input-panel').show();
			$('#upload-wait,#upload-panel').hide();
		}
		xhr.onload = function() {
			var ans = JSON.parse(xhr.responseText);
			finish();
			if (ans.image && ans.image.link) $('#input').insertLine(ans.image.link.replace(/^http:/,'https:'));
			else alert("Hu? didn't exactly work, I think...");
			console.log("Image upload result:", ans);
			document.getElementById('file').value = null;
		}
		xhr.onerror = function(){
			alert("Something didn't work as expected :(");
			document.getElementById('file').value = null;
			finish();
		}
		$('#upload-controls,#input-panel').hide();
		$('#upload-wait,#upload-panel').show();
		xhr.send(fd);
	}
		
	document.addEventListener('paste', function(e){
		var input = document.getElementById('input');
		if (!input) return;
		ed.stateBeforePaste = {
			selectionStart:input.selectionStart, selectionEnd:input.selectionEnd, value:input.value
		};
		var files = e.clipboardData.files;
		if (!files && e.clipboardData.items) {
			files = e.clipboardData.items.map(function(item){
				return item.getAsFile();
			});
		}
		if (!files) return;
		for (var i=0; i<files.length; i++) {
			if (/^image\//i.test(files[i].type)) {
				uploadFile(files[i]);
				return false;
			}
		}
	});

	$('#uploadSend').click(function(){
		var file = document.getElementById('file').files[0];
		if (!file || !/^image\//i.test(file.type)) {
			alert('not a valid image');
			return;
		}
		uploadFile(file);
	});
	
});
