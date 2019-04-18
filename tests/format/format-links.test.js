require("./format.js");

doTests("Formatting - Links", {
	"raw URL": t(
		"raw URL : http://dystroy.org/index.html?a=b",
		'raw URL : <a target=_blank href="http://dystroy.org/index.html?a=b">http://dystroy.org/index.html?a=b</a>'
	),
	"markdown link": t(
		"[dystroy](http://dystroy.org)",
		'<a target=_blank href="http://dystroy.org">dystroy</a>'
	),
	"markdown link to room": t(
		"[room #123](123#)",
		'<a target=_blank href=123#>room #123</a>'
	),
	"markdown link to room to message": t(
		"[message #456 in room #123](123#456)",
		'<a target=_blank href=123#456>message #456 in room #123</a>'
	),
	"markdown link to user by num": t(
		"[dystroy](u/1)",
		'<a target=_blank href=user/1>dystroy</a>'
	),
	"markdown link to user by name": t(
		"[dystroy](u/dystroy)",
		'<a target=_blank href=user/dystroy>dystroy</a>'
	),
	"markdown link with commas": t(
		"[dystroy](http://dystroy.org/bla,bla,bla)",
		'<a target=_blank href="http://dystroy.org/bla,bla,bla">dystroy</a>'
	),
	"markdown link with parentheses, between parentheses": t(
		"test ([un fromage](https://fr.wikipedia.org/wiki/Morge_(fromage)))",
		'test (<a target=_blank href="https://fr.wikipedia.org/wiki/Morge_(fromage)">un fromage</a>)'
	),
	"markdown link with an URL as name": t(
		'[http://dystroy.org](http://dystroy.org/cv)',
		'<a target=_blank href="http://dystroy.org/cv">http://dystroy.org</a>'
	),
	"tricky URL with underscores - 1": t(
		"http://this.link/shouldnt_be_styled/index.xml",
		'<a target=_blank href="http://this.link/shouldnt_be_styled/index.xml">http://this.link/shouldnt_be_styled/index.xml</a>'
	),
	"URL between parentheses": t(
		"see my site (https://dystroy.org)",
		'see my site (<a target=_blank href="https://dystroy.org">https://dystroy.org</a>)'
	),
	"URL with parentheses": t(
		"see wikipedia: https://fr.wikipedia.org/wiki/Morge_(fromage)",
		'see wikipedia: <a target=_blank href="https://fr.wikipedia.org/wiki/Morge_(fromage)">https://fr.wikipedia.org/wiki/Morge_(fromage)</a>'
	),
	"// URL with nested parentheses between parentheses": t(
		"yes (https://a.org/wiki/(b(c)))",
		'yes (<a target=_blank href="https://a.org/wiki/(b(c))">https://a.org/wiki/(b(c))</a>)'
	),
	"Google Maps URL": t(
		"test: https://www.google.com/maps/dir/Chez+Alain,+18+Rue+Poullain+Duparc,+35000+Rennes/Acc%C3%A8s+au+Gymnase+de+la+Courrouze+(Parking),+Avenue+Jules+Maniez,+35000+Rennes/@48.1029505,-1.6962157,15z/am=t/data=!4m18!4m17!1m5!1m1!1s0x480ede3344059169:0x5227241621f08b6e!2m2!1d-1.6810263!2d48.1087104!1m5!1m1!1s0x480edf46cf8183d3:0x6136b7a70903bedc!2m2!1d-1.6947851!2d48.987701!2m3!6e1!7e2!8j1555435800!3e3",
		'test: <a target=_blank href="https://www.google.com/maps/dir/Chez+Alain,+18+Rue+Poullain+Duparc,+35000+Rennes/Acc%C3%A8s+au+Gymnase+de+la+Courrouze+(Parking),+Avenue+Jules+Maniez,+35000+Rennes/@48.1029505,-1.6962157,15z/am=t/data=!4m18!4m17!1m5!1m1!1s0x480ede3344059169:0x5227241621f08b6e!2m2!1d-1.6810263!2d48.1087104!1m5!1m1!1s0x480edf46cf8183d3:0x6136b7a70903bedc!2m2!1d-1.6947851!2d48.987701!2m3!6e1!7e2!8j1555435800!3e3">https://www.google.com/maps/dir/Chez+Alain,+18+Rue+Poullain+Duparc,+35000+Rennes/Acc%C3%A8s+au+Gymnase+de+la+Courrouze+(Parking),+Avenue+Jules+Maniez,+35000+Rennes/@48.1029505,-1.6962157,15z/am=t/data=!4m18!4m17!1m5!1m1!1s0x480ede3344059169:0x5227241621f08b6e!2m2!1d-1.6810263!2d48.1087104!1m5!1m1!1s0x480edf46cf8183d3:0x6136b7a70903bedc!2m2!1d-1.6947851!2d48.987701!2m3!6e1!7e2!8j1555435800!3e3</a>'
	),
	"PHP BB": t(
		`[url=http://www.mountyhall.com/Forum/display_topic_threads.php?ThreadID=2539853#2539853]test[/url]`,
		`[url=<a target=_blank href="http://www.mountyhall.com/Forum/display_topic_threads.php?ThreadID=2539853#2539853">http://www.mountyhall.com/Forum/display_topic_threads.php?ThreadID=2539853#2539853</a>]test[/url]`
	),
	"URL with parentheses between parentheses": t(
		"yes (see wikipedia: https://fr.wikipedia.org/wiki/Morge_(fromage))!",
		'yes (see wikipedia: <a target=_blank href="https://fr.wikipedia.org/wiki/Morge_(fromage)">https://fr.wikipedia.org/wiki/Morge_(fromage)</a>)!'
	),
	"comma separated list of tricky URLs, between parentheses": t(
		"yes (https://fr.w.org/w/M_(a), https://dystroy.org/a?b=c,d)!",
		'yes (<a target=_blank href="https://fr.w.org/w/M_(a)">https://fr.w.org/w/M_(a)</a>, <a target=_blank href="https://dystroy.org/a?b=c,d">https://dystroy.org/a?b=c,d</a>)!'
	),
	"URLs with only one space as separator": t(
		"https://dystroy.org http://canop.org/(a) https://miaou.com",
		'<a target=_blank href="https://dystroy.org">https://dystroy.org</a> <a target=_blank href="http://canop.org/(a)">http://canop.org/(a)</a> <a target=_blank href="https://miaou.com">https://miaou.com</a>',
	),
	"tricky URL with underscores - 2": t(
		"[This link has a tricky href](http://miaou.dystroy.org/help#Ping_and_reply)",
		'<a target=_blank href="http://miaou.dystroy.org/help#Ping_and_reply">This link has a tricky href</a>'
	),
	"// tricky URL with @": t(
		"https://medium.com/@sebmck/2015-in-review-51ac7035e272#.52hda93q5",
		'<a target=_blank href="https://medium.com/@sebmck/2015-in-review-51ac7035e272#.52hda93q5">https://medium.com/@sebmck/2015-in-review-51ac7035e272#.52hda93q5</a>'
	),
	"style in markdown link": t(
		"[This md styled link has some **bold** and *italic*](http://miaou.dystroy.org/help#Ping_and_reply)",
		'<a target=_blank href="http://miaou.dystroy.org/help#Ping_and_reply">This md styled link has some <b>bold</b> and <i>italic</i></a>'
	),
	"boldened raw URL": t(
		"** http://dystroy.org **",
		'<b> <a target=_blank href="http://dystroy.org">http://dystroy.org</a> </b>'
	),
	"// striken markdown link without space": t(
		"---[http://why/this/no/strikeout?](http://why/this/no/strikeout?)---",
		'<strike><a target=_blank href="http://why/this/no/strikeout?">http://why/this/no/strikeout?</a></strike>'
	),
	"markdown link in a striken sentence": t( // bug : http://miaou.dystroy.org/3?Code_Croissants#525888
		"@Florian ---c'est quel langage ton fichier de provisionning vagrant https://github.com/Canop/miaou/blob/master/vagrant/manifests/default.pp#L1 ?--- ok > Puppet",
		"<span class=\"ping\">@Florian</span> <strike>c'est quel langage ton fichier de provisionning vagrant <a target=_blank href=\"https://github.com/Canop/miaou/blob/master/vagrant/manifests/default.pp#L1\">https://github.com/Canop/miaou/blob/master/vagrant/manifests/default.pp#L1</a> ?</strike> ok &gt; Puppet"
	),
	"markdown link in a bold sentence": t(
		"@Florian **c'est quel langage ton fichier de provisionning vagrant https://github.com/Canop/miaou/blob/master/vagrant/manifests/default.pp#L1 ?** ok > Puppet",
		"<span class=\"ping\">@Florian</span> <b>c'est quel langage ton fichier de provisionning vagrant <a target=_blank href=\"https://github.com/Canop/miaou/blob/master/vagrant/manifests/default.pp#L1\">https://github.com/Canop/miaou/blob/master/vagrant/manifests/default.pp#L1</a> ?</b> ok &gt; Puppet"
	),
	"markdown link in a italicized sentence": t(
		"@Florian *c'est quel langage ton fichier de provisionning vagrant https://github.com/Canop/miaou/blob/master/vagrant/manifests/default.pp#L1 ?* ok > Puppet",
		"<span class=\"ping\">@Florian</span> <i>c'est quel langage ton fichier de provisionning vagrant <a target=_blank href=\"https://github.com/Canop/miaou/blob/master/vagrant/manifests/default.pp#L1\">https://github.com/Canop/miaou/blob/master/vagrant/manifests/default.pp#L1</a> ?</i> ok &gt; Puppet"
	),
	"markdown link in title": t(
		"# [link](http://some.com/link) here !",
		'<span class=h1><a target=_blank href="http://some.com/link">link</a> here !</span>'
	),
	"raw URL with tilde": t(
		"bla https://www.slant.co/versus/42/62/~vim_vs_neovim",
		'bla <a target=_blank href="https://www.slant.co/versus/42/62/~vim_vs_neovim">https://www.slant.co/versus/42/62/~vim_vs_neovim</a>'
	),
	"markdown link with URL as label": t( // bug : https://miaou.dystroy.org/3?Code_Croissants#8166083
		"[https://youtu.be/E_WF8BEwxxw?t=29](https://youtu.be/E_WF8BEwxxw?t=29)",
		'<a target=_blank href="https://youtu.be/E_WF8BEwxxw?t=29">https://youtu.be/E_WF8BEwxxw?t=29</a>'
	)
});
