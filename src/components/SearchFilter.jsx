export default function SearchFilter({
  searchText,
  setSearchText,
  designationFilter,
  setDesignationFilter,
  thesisFilter,
  setThesisFilter
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        flexWrap: "wrap",
        marginBottom: 20
      }}
    >
      <input
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        placeholder="Search by name, code, designation, or research..."
        style={{
          padding: "10px 12px",
          borderRadius: 10,
          border: "1px solid #d1d5db",
          width: 340
        }}
      />

      <select
        value={designationFilter}
        onChange={(e) => setDesignationFilter(e.target.value)}
        style={{
          padding: "10px 12px",
          borderRadius: 10,
          border: "1px solid #d1d5db"
        }}
      >
        <option value="All">All Designations</option>
        <option value="Professor">Professor</option>
        <option value="Associate Professor">Associate Professor</option>
        <option value="Assistant Professor">Assistant Professor</option>
        <option value="Senior Lecturer">Senior Lecturer</option>
        <option value="Lecturer">Lecturer</option>
        <option value="Adjunct Lecturer">Adjunct Lecturer</option>
        <option value="Chairperson">Chairperson</option>
        <option value="Dean">Dean</option>
        <option value="Unknown">Unknown</option>
      </select>

      <select
        value={thesisFilter}
        onChange={(e) => setThesisFilter(e.target.value)}
        style={{
          padding: "10px 12px",
          borderRadius: 10,
          border: "1px solid #d1d5db"
        }}
      >
        <option value="All">All Thesis Status</option>
        <option value="Accepting">Accepting</option>
        <option value="Not Accepting">Not Accepting</option>
        <option value="Unknown">Unknown</option>
      </select>
    </div>
  );
}