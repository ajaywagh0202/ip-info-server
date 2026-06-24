import Department from "../models/Department.js";
import RegisterUser from "../models/RegisterUser.js";

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const exactCaseInsensitive = (value) =>
  new RegExp(`^${escapeRegex(String(value || "").trim())}$`, "i");

const combineQueries = (...queries) => {
  const populatedQueries = queries.filter(
    (query) => query && Object.keys(query).length
  );

  if (populatedQueries.length === 0) {
    return {};
  }

  if (populatedQueries.length === 1) {
    return populatedQueries[0];
  }

  return { $and: populatedQueries };
};

/**
 * Builds an IpInfo query that represents exactly one department. It supports
 * legacy IpInfo documents that do not contain dept_code by matching PF numbers
 * belonging to RegisterUser records in the requested department.
 */
export const getDepartmentScope = async ({ deptCode, deptName } = {}) => {
  const normalizedDeptCode = String(deptCode || "").trim();

  if (!normalizedDeptCode) {
    return { _id: { $exists: false } };
  }

  const department = await Department.findOne({
    dept_code: exactCaseInsensitive(normalizedDeptCode)
  })
    .select("deptname")
    .lean();
  const departmentNames = [deptName, department?.deptname]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  const userDepartmentFilters = [
    { dept_code: exactCaseInsensitive(normalizedDeptCode) },
    ...departmentNames.flatMap((name) => [
      { department: exactCaseInsensitive(name) },
      { dept_name: exactCaseInsensitive(name) }
    ])
  ];
  const users = await RegisterUser.find({ $or: userDepartmentFilters })
    .select("pf_no")
    .lean();
  const pfNumbers = [
    ...new Set(
      users
        .map((user) => String(user.pf_no || "").trim())
        .filter(Boolean)
    )
  ];
  const ipInfoFilters = [
    { dept_code: exactCaseInsensitive(normalizedDeptCode) }
  ];

  if (pfNumbers.length) {
    ipInfoFilters.push({ pf_no: { $in: pfNumbers } });
  }

  return { $or: ipInfoFilters };
};

/**
 * user_type 0 can access all departments (or a selected department filter).
 * user_type 1 is always restricted to the department currently assigned to
 * their admin account; client query parameters cannot broaden that scope.
 */
export const applyDepartmentScope = async (req, query = {}, options = {}) => {
  const userType = Number(req.admin?.user_type);

  if (userType === 1) {
    const scope = await getDepartmentScope({
      deptCode: req.admin?.dept_code,
      deptName: req.admin?.dept_name
    });
    return combineQueries(query, scope);
  }

  if (options.deptCode) {
    const scope = await getDepartmentScope({
      deptCode: options.deptCode,
      deptName: options.deptName
    });
    return combineQueries(query, scope);
  }

  return query;
};
