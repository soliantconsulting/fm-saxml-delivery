<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">

    <!-- Specify no XML declaration in the output -->
    <xsl:output method="text" omit-xml-declaration="yes" />

    <!-- Template to match the root of the XML document -->
    <xsl:template match="/">
        <!-- Add header row -->
        <xsl:text>db,table_id,table_name&#10;</xsl:text>
        
        <!-- Get db name with file extension -->
        <xsl:variable name="file_name" select="substring(FMSaveAsXML/@File, 1, string-length(FMSaveAsXML/@File) - 6)" />

        <!-- Loop over the BaseTable -->
        <xsl:for-each select="FMSaveAsXML/Structure/AddAction/BaseTableCatalog/BaseTable">
            <xsl:value-of select="concat($file_name, ',', @id, ',', @name)" />
            <xsl:text>&#10;</xsl:text>
        </xsl:for-each>
    </xsl:template>

</xsl:stylesheet>