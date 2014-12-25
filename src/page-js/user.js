miaou(function(locals){

	if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|Mini/i.test(navigator.userAgent)) $(document.body).addClass('mobile');
	var user = locals.user,
		userinfo = locals.userinfo;
	document.title = user.name + ' @ Miaou';
	locals.rooms.forEach(function(r){
		$('<tr>').append(
			$('<td>').addClass(r.private?'private':'public').append($('<a>').attr('href',r.path).text(r.name))
		).append(
			$('<td>').addClass('rendered').html(miaou.mdToHtml(r.description))
		).appendTo('#recentRooms');
	});
	
	if (userinfo.location) {
		$('#userinfo').append(
			$('<tr>').append(
				$('<th>').text('location')
			).append(
				$('<td>').text(userinfo.location)
			)
		);
	}
	if (userinfo.url) {
		$('#userinfo').append(
			$('<tr>').append(
				$('<th>').text('website')
			).append(
				$('<td>').append($('<a>').text(userinfo.url).attr('href', userinfo.url))
			)
		);
	}
	if (userinfo.description) {
		$('#userinfo').append(
			$('<tr>').append(
				$('<th>').text('self description')
			).append(
				$('<td>').text(userinfo.description)
			)
		);
	}
	$(window).load(function(){
		setTimeout(function(){
			$('#whatsmiaou').addClass('on').click(function(){
				location = '../static/intro.html';
			});
			setTimeout(function(){
				$('#whatsmiaou').text("Discover Miaou !");
			}, 4000);
		}, 1500);
	});

});
