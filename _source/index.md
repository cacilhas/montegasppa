---
type: page
original: http://montegasppa.blogspot.in/2006/07/prlogo.html
---
<p class="mg-first">Everytime I was talking to a friend blogger, he proposed me
  to write a blog. I never thought seriously until
  <a href="{{ original }}">July 2006</a>,
  when I wrote the first <strong>{{ blog.title }}</strong> post.
</p>


That blog was about Computing, Free Software and programming, but eventually
became a political blog, strongly because I have moved the programming’s
responsability to <a href="{{ kodumaro.url }}">{{ kodumaro.title }}</a>.

Later {{ title }} turned into my personal blog, where I throw up everything
affects me, from religion to music, from Computing to Politics.

It was reborn under my <a href="{{ site }}/">personal website</a>, slightly
renamed, once I’ve changed “Monte Gasppa” to “ℳontegasppα”, but more and more
my **personal** blog.

### Posts

<ul id="postsList"></ul>

### Tags

<ul id="tagsList"></ul>

<script>
  $.getJSON('/posts.json', function(posts) {
    for (var post of posts) {
      $('#postsList').append('<li><a href="' + post.url + '">' + post.title + '</a></li>')
    }
  })

  $.getJSON('/tags.json', function(tags) {
    for (var tag of tags) {
      $('#tagsList').append('<li><a href="/?tag=' + tag + '">' + tag + '</a></li>')
    }
  })
</script>
