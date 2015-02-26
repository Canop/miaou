miaou(function(locals){

	$('#goto-home').click(function(){ location = '../rooms' });

	//~ locals.rooms.forEach(function(r){
		//~ $('<tr>').append(
			//~ $('<td>').addClass(r.private?'private':'public').append($('<a>').attr('href',r.path).text(r.name))
		//~ ).append(
			//~ $('<td>').addClass('rendered').html(miaou.mdToHtml(r.description))
		//~ ).appendTo('#recentRooms');
	//~ });

});
