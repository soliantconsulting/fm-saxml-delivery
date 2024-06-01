# fm xml download 

This is intended to download a filemaker SaXML out of a container that is generated by script into a folder called SaXML.

you must setup the following environment variables
* FM_HOST=https://fm.example.com
* FM_USERNAME=user
* FM_PASSWORD=password
* FM_FILES=file,anotherFile,yetAnotherFile

```pnpm dlx @soliantconsulting/fm-saxml-delivery```
