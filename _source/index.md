---
type: page
date: 2020-09-30
---
[original]: http://montegasppa.blogspot.com/2006/07/prlogo.html

{:class="mg-first"} Everytime I was talking to a friend blogger, he proposed me
to write a blog. I’d never thought seriously until [July 2006][original], when I
wrote the first **{{ blog.title }}** post.


That blog was about Computing, Free Software and programming, but eventually
became a political blog, strongly because I have moved the programming’s
responsability to <a href="{{{ kodumaro.url }}}">{{ kodumaro.title }}</a>.

Later {{ title }} turned into my personal blog, where I throw up everything
affects me, from religion to music, from Computing to Politics.

It was reborn under my <a href="{{{ site }}}/">personal website</a>, slightly
renamed, once I’ve changed “Monte Gasppa” to “ℳontegasppα,” but more and more
my **personal** blog.

### Posts

<ul id="postsList">
  <noscript>Please enable Javascript to view the posts.</noscript>
</ul>

### Tags

<ul id="tagsList">
  <noscript>Please enable Javascript to view the posts.</noscript>
</ul>

### Previous posts

You can find older posts in the [legacy page](/legacy.html).

<script>
  var urlParams = new URLSearchParams(window.location.search)
  var currentTag = urlParams.get('tag')

  if (currentTag) {
    $('#posts').text('Posts at ')
    $('#posts').append('<code>' + currentTag + '</code>')
    $('#postsList').append('<li><a href="/">Back home</a></li>')
    $.getJSON('/tags/' + currentTag + '.json', function(posts) {
      for (var post of posts) {
        $('#postsList').append(
          '<li><small>[' + post.date + ']</small> <a href="' + post.url + '">' + post.title + '</a></li>'
        )
      }
    })

  } else {
    $('#posts').text('Latest posts')
    $.getJSON('/posts.json', function(posts) {
      for (var post of posts) {
        $('#postsList').append(
          '<li><small>[' + post.date + ']</small> <a href="' + post.url + '">' + post.title + '</a></li>'
        )
      }
    })
  }

  $.getJSON('/tags.json', function(tags) {
    for (var tag of tags) {
      $('#tagsList').append('<li><a href="/?tag=' + tag + '"><code>' + tag.replace(/-/g, ' ') + '</code></a></li>')
    }
  })
</script>
