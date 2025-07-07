<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">

    <!-- Specify no XML declaration in the output -->
    <xsl:output method="text" omit-xml-declaration="yes" />

    <!-- Template to match the root of the XML document -->
    <xsl:template match="/">
        <!-- Add header row -->
        <xsl:text>db,field_id,field_name,table_id,table_name&#10;</xsl:text>
        
        <!-- Get db name with file extension -->
        <xsl:variable name="file_name" select="substring(FMSaveAsXML/@File, 1, string-length(FMSaveAsXML/@File) - 6)" />

        <!-- Loop over the BaseTableReference and Field nodes with updated path -->
        <xsl:for-each select="FMSaveAsXML/Structure/AddAction/FieldsForTables/FieldCatalog">
            <xsl:variable name="table_id" select="BaseTableReference/@id" />
            <xsl:variable name="table_name" select="BaseTableReference/@name" />

            <!-- Loop over the Field elements inside ObjectList with updated path -->
            <xsl:for-each select="ObjectList/Field">
                <xsl:value-of select="concat($file_name, ',', @id, ',', @name, ',', $table_id, ',', $table_name)" />
                <xsl:text>&#10;</xsl:text>
            </xsl:for-each>
        </xsl:for-each>
    </xsl:template>

</xsl:stylesheet>