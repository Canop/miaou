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
	"markdown link with an URL as name": t(
		'[http://dystroy.org](http://dystroy.org/cv)',
		'<a target=_blank href="http://dystroy.org/cv">http://dystroy.org</a>'
	),
	"tricky URL with underscores - 1": t(
		"http://this.link/shouldnt_be_styled/index.xml",
		'<a target=_blank href="http://this.link/shouldnt_be_styled/index.xml">http://this.link/shouldnt_be_styled/index.xml</a>'
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
