RWD - YALL (Yet Another Lazy Loader)
==========

RWD lazyloading with Akamai support.


### Problem ###

TL; DR: We're loading way too many images, and it's slowing down the user experience and burning lotsa bandwidth. UX = income. Bandwidth = expense.

##### Different images for different screen sizes/devices

Normally, all `<img>` tags and `background-image` requests are made right when a page is loaded in the browser. Even if an image tag is set to `display: none`, the image is still requested. That means the user has to wait for that image to be downloaded even if they'll never actually see it.

This problem is especially pronounced on RWD pages, where images of different sizes are shown at different screen widths. A cell phone will still download that big desktop header image, even though it'll only show the small mobile header image.

##### Images outside the viewport

When a webpage first loads, the only images that matter are the ones at the top - the ones inside the browser window. Images way down at the bottom of the page don't matter, as the user can't see them yet. So why load those ones at the bottom unless the user is about to look at them?



### Design Goals ###

Why we made the choices we made.

* Minimize HTML: Simple HTML is maintainable HTML. Also, bloated HTML is extra data to move down the wire and a burden for the browser to parse and manipulate. We favored an HTML syntax that lets the JS do as much of the work as possible.


### How to use it ###

Simply modify any `<img>` tag that you want to lazyload by replacing `src=image.jpg` with `data-src=image.jpg` and add an attribute called `sourcesAvail` with one or more of the following parameters, separated by dashes:

	S
	L
	SR
	LR

For example: `<img data-src="image.jpg" sourcesAvail="S-L-SR-LR">`

N.B.: Your old non-Optiviewer code won't break



### Features ###







### What it is ###

Combination of unveil + picturefill + our own Akamai solution