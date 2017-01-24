# seoscribe/editor

The source code for the SEO Scribe text editor.

The text editor listens to the `keyup` event, among others, and sends the text entered to a Web Worker, which processes the text and returns a series of numbers which are to be displayed in the UI.

Essentially, we offload a bunch of computationally expensive Regular Expressions to a second thread while using a closure to persist variables which will be required for the duration of the web app's use, in order to maximise performance.

Data is stored to `localStorage` and the text written can be exported to `txt`,`html`,`rtf`, `docx` and `pdf`.

A ServiceWorker is included to enable immediate load.
