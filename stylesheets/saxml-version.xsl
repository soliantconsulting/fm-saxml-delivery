<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
    <xsl:output method="text" encoding="UTF-8"/>
    
    <!-- Extract version from FMSaveAsXML/@version -->
    <xsl:template match="/">
        <xsl:value-of select="/FMSaveAsXML/@version"/>
    </xsl:template>
</xsl:stylesheet> 