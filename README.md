# seoscribe/editor

The source code for the SEO Scribe text editor.

The text editor listens to the `keyup` event, among others, and sends the text entered to a Web Worker, which processes the text and returns a series of numbers which are reflected in the UI.

Essentially, we offload a bunch of computationally expensive Regular Expressions to a worker thread.

Data is stored to `localStorage` and the text written can be exported to `txt`, `html`, `rtf`, `docx` and `pdf`.

A ServiceWorker is included to enable offline use and prefetching of resources. Offline usage is limited to whatever keyword was cached on the web app's last use, as the keyword suggestions cannot be retrieved without an internet connection.

A CORS proxy is more or less a requirement for the editor to function, as we retrieve keyword suggestions from multiple external web services.

In the long term, a keyword suggestion API could be built into a back-end service bespoke to this application. While there is no better place to obtain keyword suggestions than the search engines themselves, the web services we query may one day be closed to external access, and thus a future-proof solution would include a bespoke solution with as close an approximation to search engine algorithms as possible.
